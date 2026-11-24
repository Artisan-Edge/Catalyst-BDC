import type { AsyncResult } from '../../../types/result';
import type { DatasphereRequestor } from '../../../types/requestor';
import { checkResponse } from '../../http/checkResponse';
import { DATASPHERE_OBJECT_TYPES } from '../../../types/objectTypes';
import { debug } from '../../utils/logging';

// The control as saved, {"definitions": {NAME: {...}}} (the default Accept: all content)
export async function readDataAccessControl(
    requestor: DatasphereRequestor,
    space: string,
    objectName: string,
): AsyncResult<string> {
    const objectType = DATASPHERE_OBJECT_TYPES['data-access-control'];

    debug(`Reading data access control "${objectName}"...`);

    const [response, reqErr] = await requestor.request({
        method: 'GET',
        path: `/dwaas-core/api/v1/spaces/${encodeURIComponent(space)}/${objectType.endpoint}/${encodeURIComponent(objectName)}`,
    });

    return checkResponse(response, reqErr, `Read data access control "${objectName}"`);
}
