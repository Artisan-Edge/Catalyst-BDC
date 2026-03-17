import type { DatasphereRequestor } from '../types/requestor';
import type { AsyncResult } from '../types/result';
import { ok, err } from '../types/result';
import { safeJsonParse } from '../core/utils/json';
import { debug } from '../core/utils/logging';
import {
    INA_GET_RESPONSE_PATH, INA_CAPABILITIES,
    InaResponseSchema,
} from './types';
import type { InaQueryOptions, InaQueryResult, InaCellRow, InaDimensionRequest } from './types';
import type { InaCsrfToken } from './fetchInaCsrf';

const DEFAULT_ROW_LIMIT = 200;
const DEFAULT_COLUMN_LIMIT = 50;

function buildDimensions(options: InaQueryOptions): InaDimensionRequest[] {
    const dims: InaDimensionRequest[] = [];

    // User-specified row dimensions
    for (const dim of options.dimensions ?? []) {
        dims.push(dim);
    }

    // Measures go on the Columns axis as CustomDimension1
    if (options.measures && options.measures.length > 0) {
        dims.push({
            Name: 'CustomDimension1',
            Axis: 'Columns',
            Members: options.measures.map((m) => ({ MemberName: m })),
        });
    }

    return dims;
}

function buildPayload(options: InaQueryOptions): unknown {
    const definition: Record<string, unknown> = {
        Dimensions: buildDimensions(options),
        ResultSetFeatureRequest: {
            ResultEncoding: 'None',
            ResultFormat: 'Version2',
            ReturnedDataSelection: {
                Values: true,
                ValuesFormatted: true,
                ValuesRounded: true,
                CellDataType: true,
                CellMeasure: true,
                UnitIndex: true,
                Units: true,
                UnitDescriptions: true,
                TupleElementIds: true,
                TupleDisplayLevel: true,
                TupleDrillState: true,
                TupleLevel: true,
                TupleParentIndexes: true,
            },
            SubSetDescription: {
                ColumnFrom: 0,
                ColumnTo: options.columnLimit ?? DEFAULT_COLUMN_LIMIT,
                RowFrom: 0,
                RowTo: options.rowLimit ?? DEFAULT_ROW_LIMIT,
            },
            TupleCountTotal: true,
        },
    };

    if (options.variables && options.variables.length > 0) {
        definition['Variables'] = options.variables;
    }

    if (options.filter) {
        definition['DynamicFilter'] = {
            Selection: {
                SetOperand: options.filter,
            },
        };
    }

    return {
        Analytics: {
            Capabilities: INA_CAPABILITIES,
            DataSource: {
                ObjectName: options.dataSource.ObjectName,
                SchemaName: options.dataSource.SchemaName,
                Type: options.dataSource.Type ?? 'InAModel',
                ...(options.dataSource.InstanceId ? { InstanceId: options.dataSource.InstanceId } : {}),
            },
            Definition: definition,
            Language: 'EN',
        },
    };
}

/**
 * Flatten the Version2 grid result into simple row objects.
 * Each row maps dimension names + measure names to their values.
 */
function flattenGrid(grid: Record<string, unknown>): {
    rows: InaCellRow[];
    totalRows: number;
    totalColumns: number;
    units: Record<string, string>;
} {
    const axes = (grid['Axes'] ?? []) as Array<Record<string, unknown>>;
    const cellArraySizes = (grid['CellArraySizes'] ?? [0, 0]) as number[];
    const numRows = cellArraySizes[0] ?? 0;
    const numCols = cellArraySizes[1] ?? 1;

    // Extract row dimension values from ROWS axis
    const rowAxis = axes.find((a) => a['Type'] === 'Rows');
    const colAxis = axes.find((a) => a['Type'] === 'Columns');

    // Get row tuple element IDs (dimension member values per row)
    const rowDims: Array<{ name: string; values: unknown[] }> = [];
    if (rowAxis) {
        const dims = (rowAxis['Dimensions'] ?? []) as Array<Record<string, unknown>>;
        const tuples = (rowAxis['Tuples'] ?? []) as Array<Record<string, unknown>>;
        for (const dim of dims) {
            const dimName = dim['Name'] as string;
            // Get values from the key attribute
            const attrs = (dim['Attributes'] ?? []) as Array<Record<string, unknown>>;
            const keyAttr = attrs.find((a) => a['IsKey'] === true) ?? attrs[0];
            const values = (keyAttr?.['Values'] ?? []) as unknown[];
            rowDims.push({ name: dimName, values });
        }

        // If no attribute values, try TupleElementIds
        const firstDim = rowDims[0];
        if (firstDim && firstDim.values.length === 0 && tuples.length > 0) {
            const tuple = tuples[0] as Record<string, unknown>;
            const ids = tuple['TupleElementIds'] as Record<string, unknown> | undefined;
            if (ids) {
                const idValues = (ids['Values'] ?? []) as unknown[];
                if (rowDims.length === 1) {
                    firstDim.values = idValues;
                }
            }
        }
    }

    // Get measure names from COLUMNS axis
    const measureNames: string[] = [];
    if (colAxis) {
        const dims = (colAxis['Dimensions'] ?? []) as Array<Record<string, unknown>>;
        for (const dim of dims) {
            const attrs = (dim['Attributes'] ?? []) as Array<Record<string, unknown>>;
            const keyAttr = attrs.find((a) => a['PresentationType'] === 'Key') ?? attrs[0];
            const values = (keyAttr?.['Values'] ?? []) as string[];
            measureNames.push(...values);
        }
    }

    // Get cell values
    const cells = grid['Cells'] as Record<string, unknown> | undefined;
    const cellValues = ((cells?.['Values'] as Record<string, unknown>)?.['Values'] ?? []) as unknown[];
    const cellFormatted = ((cells?.['ValuesFormatted'] as Record<string, unknown>)?.['Values'] ?? []) as string[];

    // Extract units
    const units: Record<string, string> = {};
    const cellUnits = ((cells?.['Units'] as Record<string, unknown>)?.['Values'] ?? []) as string[];
    const cellMeasures = ((cells?.['CellMeasure'] as Record<string, unknown>)?.['Values'] ?? []) as string[];

    // Build row objects
    const rows: InaCellRow[] = [];
    for (let r = 0; r < numRows; r++) {
        const row: InaCellRow = {};

        // Add dimension values
        for (const dim of rowDims) {
            row[dim.name] = dim.values[r];
        }

        // Add measure values (cells are laid out as [row0_col0, row0_col1, ..., row1_col0, ...])
        for (let c = 0; c < numCols; c++) {
            const cellIdx = r * numCols + c;
            const measureName = measureNames[c] ?? `measure_${c}`;
            row[measureName] = cellValues[cellIdx];
            if (cellFormatted[cellIdx] !== undefined) {
                row[`${measureName}_formatted`] = cellFormatted[cellIdx];
            }
            if (cellUnits[cellIdx] && !units[measureName]) {
                units[measureName] = cellUnits[cellIdx];
            }
        }

        rows.push(row);
    }

    // Get total counts from axis metadata
    const totalRows = (rowAxis?.['TupleCountTotal'] as number) ?? numRows;
    const totalColumns = (colAxis?.['TupleCountTotal'] as number) ?? numCols;

    return { rows, totalRows, totalColumns, units };
}

export async function queryData(
    requestor: DatasphereRequestor,
    inaCsrf: InaCsrfToken,
    options: InaQueryOptions,
): AsyncResult<InaQueryResult> {
    debug(`INA queryData: ${options.dataSource.SchemaName}.${options.dataSource.ObjectName}`);

    const payload = buildPayload(options);

    const [response, reqErr] = await requestor.request({
        method: 'POST',
        path: INA_GET_RESPONSE_PATH,
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-Csrf-Token': inaCsrf.csrf,
            'Cookie': inaCsrf.cookies,
        },
        body: JSON.stringify(payload),
    });

    if (reqErr) return err(reqErr);

    const body = await response.text();
    if (!response.ok) {
        return err(new Error(`INA queryData: HTTP ${response.status} — ${body.substring(0, 500)}`));
    }

    const [parsed, parseErr] = safeJsonParse(body, InaResponseSchema);
    if (parseErr) return err(new Error(`INA queryData: ${parseErr.message}`));

    // Check for error messages (Type 2 = error)
    const errorMessages = parsed.Messages?.filter((m) => m.Type === 2);
    if (errorMessages && errorMessages.length > 0) {
        const texts = errorMessages.map((m) => m.Text ?? 'Unknown error').join('; ');
        return err(new Error(`INA queryData: ${texts}`));
    }

    // Check grid-level errors
    const grids = parsed.Grids ?? [];
    if (grids.length === 0) {
        return err(new Error('INA queryData: no grids in response'));
    }

    const grid = grids[0]!;
    if (grid.HasErrors) {
        const gridMsgs = grid.Messages?.map((m) => m.Text).join('; ') ?? 'Unknown grid error';
        return err(new Error(`INA queryData: ${gridMsgs}`));
    }

    const { rows, totalRows, totalColumns, units } = flattenGrid(grid as unknown as Record<string, unknown>);

    debug(`INA queryData: ${rows.length} rows (${totalRows} total), ${totalColumns} columns`);

    return ok({ rows, totalRows, totalColumns, units, raw: parsed });
}
