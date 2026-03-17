import type { DatasphereRequestor } from '../types/requestor';
import type { AsyncResult } from '../types/result';
import { ok, err } from '../types/result';
import { safeJsonParse } from '../core/utils/json';
import { debug } from '../core/utils/logging';
import {
    INA_GET_RESPONSE_PATH, INA_CAPABILITIES,
    InaResponseSchema,
} from './types';
import type {
    InaDataSource, InaMetadataResult, InaDimensionInfo, InaAttributeInfo, InaVariable,
} from './types';
import type { InaCsrfToken } from './fetchInaCsrf';

export async function getMetadata(
    requestor: DatasphereRequestor,
    inaCsrf: InaCsrfToken,
    dataSource: InaDataSource,
    variables?: InaVariable[],
): AsyncResult<InaMetadataResult> {
    debug(`INA getMetadata: ${dataSource.SchemaName}.${dataSource.ObjectName}`);

    const definition: Record<string, unknown> = { Dimensions: [] };
    if (variables && variables.length > 0) {
        definition['Variables'] = variables;
    }

    const payload = {
        Analytics: {
            Capabilities: INA_CAPABILITIES,
            DataSource: {
                ObjectName: dataSource.ObjectName,
                SchemaName: dataSource.SchemaName,
                Type: dataSource.Type ?? 'InAModel',
                ...(dataSource.InstanceId ? { InstanceId: dataSource.InstanceId } : {}),
            },
            Definition: definition,
            Language: 'EN',
        },
    };

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
        return err(new Error(`INA getMetadata: HTTP ${response.status} — ${body.substring(0, 500)}`));
    }

    const [parsed, parseErr] = safeJsonParse(body, InaResponseSchema);
    if (parseErr) return err(new Error(`INA getMetadata: ${parseErr.message}`));

    // Check for error messages (Type 2 = error)
    const errorMessages = parsed.Messages?.filter((m) => m.Type === 2);
    if (errorMessages && errorMessages.length > 0) {
        const texts = errorMessages.map((m) => m.Text ?? 'Unknown error').join('; ');
        return err(new Error(`INA getMetadata: ${texts}`));
    }

    // Extract dimension and measure info from the grid axes
    const dimensions: InaDimensionInfo[] = [];
    const measures: string[] = [];
    const discoveredVariables: string[] = [];

    const grids = parsed.Grids ?? [];
    for (const grid of grids) {
        for (const axis of grid.Axes ?? []) {
            for (const dim of axis.Dimensions ?? []) {
                // CustomDimension1 contains the measures
                if (dim.Name === 'CustomDimension1') {
                    for (const attr of dim.Attributes ?? []) {
                        if (attr.PresentationType === 'Key' && attr.Values) {
                            for (const v of attr.Values) {
                                if (typeof v === 'string') measures.push(v);
                            }
                        }
                    }
                    continue;
                }

                const attributes: InaAttributeInfo[] = (dim.Attributes ?? []).map((attr) => ({
                    name: attr.Name,
                    description: attr.Description,
                    isKey: attr.IsKey ?? false,
                    dataType: attr.ValueType,
                }));

                dimensions.push({
                    name: dim.Name,
                    description: dim.Description,
                    dimensionType: dim.DimensionType,
                    attributes,
                });
            }
        }
    }

    debug(`INA getMetadata: ${dimensions.length} dimensions, ${measures.length} measures`);

    return ok({ dimensions, measures, variables: discoveredVariables, raw: parsed });
}
