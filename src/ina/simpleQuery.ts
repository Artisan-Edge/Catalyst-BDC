import type { DatasphereRequestor } from '../types/requestor';
import type { AsyncResult } from '../types/result';
import { debug } from '../core/utils/logging';
import { queryData } from './queryData';
import type { InaCsrfToken } from './fetchInaCsrf';
import type { InaSimpleQueryOptions, InaQueryResult, InaVariable } from './types';

const DEFAULT_ROW_LIMIT = 200;

function buildVariables(overrides: Record<string, string | number>): InaVariable[] {
    return Object.entries(overrides).map(([name, value]) =>
        typeof value === 'number'
            ? { Name: name, SimpleNumericValues: [value] }
            : { Name: name, SimpleStringValues: [String(value)] },
    );
}

export async function simpleQuery(
    requestor: DatasphereRequestor,
    inaCsrf: InaCsrfToken,
    spaceName: string,
    options: InaSimpleQueryOptions,
): AsyncResult<InaQueryResult> {
    debug(`INA simpleQuery: ${options.model}`);

    const dimensions = (options.columns ?? []).map((name) => ({
        Name: name,
        Axis: 'Rows' as const,
        ReadMode: 'BookedAndSpaceAndState',
        ResultStructure: [{ Result: 'Members', Visibility: 'Visible' }],
    }));

    const variables = buildVariables(options.variables ?? {});

    return queryData(requestor, inaCsrf, {
        dataSource: {
            ObjectName: options.model,
            SchemaName: spaceName,
            Type: 'InAModel',
        },
        dimensions,
        measures: options.measures,
        variables,
        filter: options.filter,
        rowLimit: options.limit ?? DEFAULT_ROW_LIMIT,
    });
}
