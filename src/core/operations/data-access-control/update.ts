import type { AsyncResult } from '../../../types/result';
import type { CsnFile } from '../../../types/csn';
import type { DatasphereRequestor } from '../../../types/requestor';
import type { ObjectWriteOptions } from '../../../types/operationOptions';
import { checkResponse } from '../../http/checkResponse';
import { DATASPHERE_OBJECT_TYPES } from '../../../types/objectTypes';
import { debug } from '../../utils/logging';
import { writeParams } from '../writeParams';

// Replaces a control with its CSN ({"definitions": {NAME: {...}}}) and, by default, deploys it
export async function updateDataAccessControl(
    requestor: DatasphereRequestor,
    space: string,
    objectName: string,
    content: CsnFile,
    options: ObjectWriteOptions = {},
): AsyncResult<string> {
    const objectType = DATASPHERE_OBJECT_TYPES['data-access-control'];

    debug(`Updating data access control "${objectName}"...`);

    const [response, reqErr] = await requestor.request({
        method: 'PUT',
        path: `/dwaas-core/api/v1/spaces/${encodeURIComponent(space)}/${objectType.endpoint}/${encodeURIComponent(objectName)}`,
        params: writeParams(options),
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(content),
    });

    return checkResponse(response, reqErr, `Update data access control "${objectName}"`);
}
