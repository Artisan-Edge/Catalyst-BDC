import type { DatasphereRequestor } from '../types/requestor';
import type { AsyncResult } from '../types/result';
import { ok, err } from '../types/result';
import { debug } from '../core/utils/logging';
import { getMetadata } from './getMetadata';
import type { InaCsrfToken } from './fetchInaCsrf';
import type { InaModelDetails, InaVariable } from './types';

export async function exploreModel(
    requestor: DatasphereRequestor,
    inaCsrf: InaCsrfToken,
    spaceName: string,
    modelName: string,
    variables?: InaVariable[],
): AsyncResult<InaModelDetails> {
    debug(`INA exploreModel: ${modelName}`);

    const dataSource = {
        ObjectName: modelName,
        SchemaName: spaceName,
        Type: 'InAModel' as const,
    };

    const [meta, metaErr] = await getMetadata(requestor, inaCsrf, dataSource, variables);
    if (metaErr) return err(metaErr);

    const details: InaModelDetails = {
        name: modelName,
        instanceId: (meta.raw as Record<string, unknown>)?.['DataSource']
            ? ((meta.raw as Record<string, Record<string, unknown>>)['DataSource']?.['InstanceId'] as string ?? '')
            : '',
        dimensions: meta.dimensions,
        measures: meta.measures,
        variables: meta.variables,
        raw: meta.raw,
    };

    debug(`INA exploreModel: ${details.dimensions.length} dimensions, ${details.measures.length} measures, ${details.variables.length} variables`);
    return ok(details);
}
