import type { DatasphereRequestor } from '../types/requestor';
import type { AsyncResult } from '../types/result';
import { err } from '../types/result';
import { DESIGN_OBJECT_KINDS } from '../types/designObject';
import { listObjects } from '../core/operations/navigator/listObjects';
import { debug } from '../core/utils/logging';
import type { InaModelEntry } from './types';

export async function listModels(
    requestor: DatasphereRequestor,
    spaceName: string,
    options?: { pattern?: string },
): AsyncResult<InaModelEntry[]> {
    debug('INA listModels: discovering analytic models...');

    const [objects, listErr] = await listObjects(requestor, spaceName, {
        kind: DESIGN_OBJECT_KINDS.analyticModel,
        pattern: options?.pattern,
    });
    if (listErr) return err(listErr);

    const models: InaModelEntry[] = objects.map((obj) => ({
        name: obj.name,
        businessName: obj.business_name,
        description: obj.description,
        instanceId: obj.id,
    }));

    debug(`INA listModels: found ${models.length} analytic models`);
    return [models, null];
}
