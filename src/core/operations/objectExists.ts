import type { AsyncResult } from '../../types/result';
import { ok } from '../../types/result';
import type { DatasphereRequestor } from '../../types/requestor';
import type { DatasphereObjectTypeName } from '../../types/objectTypes';
import { DATASPHERE_OBJECT_TYPES } from '../../types/objectTypes';
import { debug } from '../utils/logging';

export async function objectExists(
    requestor: DatasphereRequestor,
    space: string,
    objectType: DatasphereObjectTypeName,
    technicalName: string,
): AsyncResult<boolean> {
    const { endpoint } = DATASPHERE_OBJECT_TYPES[objectType];

    const [response, reqErr] = await requestor.request({
        method: 'GET',
        path: `/dwaas-core/api/v1/spaces/${space}/${endpoint}/${technicalName}`,
    });

    if (reqErr) {
        debug(`"${technicalName}" check failed:`, reqErr.message);
        return ok(false);
    }

    if (!response || !response.ok) {
        debug(`"${technicalName}" does not exist`);
        return ok(false);
    }

    debug(`"${technicalName}" exists`);
    return ok(true);
}
