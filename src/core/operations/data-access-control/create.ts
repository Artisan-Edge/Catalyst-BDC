import type { AsyncResult } from '../../../types/result';
import type { CsnFile } from '../../../types/csn';
import type { DatasphereRequestor } from '../../../types/requestor';
import type { ObjectWriteOptions } from '../../../types/operationOptions';
import { checkResponse } from '../../http/checkResponse';
import { DATASPHERE_OBJECT_TYPES } from '../../../types/objectTypes';
import { debug } from '../../utils/logging';
import { writeParams } from '../writeParams';

// Saves a new control from its CSN ({"definitions": {NAME: {...}}}) and, by default, deploys it
export async function createDataAccessControl(
    requestor: DatasphereRequestor,
    space: string,
    content: CsnFile,
    options: ObjectWriteOptions = {},
): AsyncResult<string> {
    const objectType = DATASPHERE_OBJECT_TYPES['data-access-control'];
    const names = Object.keys(content.definitions ?? {}).join(', ');

    debug(`Creating data access control "${names}"...`);

    const [response, reqErr] = await requestor.request({
        method: 'POST',
        path: `/dwaas-core/api/v1/spaces/${encodeURIComponent(space)}/${objectType.endpoint}`,
        params: writeParams(options),
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(content),
    });

    return checkResponse(response, reqErr, `Create data access control "${names}"`);
}
