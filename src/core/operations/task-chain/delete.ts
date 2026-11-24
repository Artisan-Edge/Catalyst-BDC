import type { AsyncResult } from '../../../types/result';
import type { DatasphereRequestor } from '../../../types/requestor';
import { checkResponse } from '../../http/checkResponse';
import { DATASPHERE_OBJECT_TYPES } from '../../../types/objectTypes';
import { debug } from '../../utils/logging';

export async function deleteTaskChain(
    requestor: DatasphereRequestor,
    space: string,
    objectName: string,
): AsyncResult<string> {
    const objectType = DATASPHERE_OBJECT_TYPES['task-chain'];

    debug(`Deleting task chain "${objectName}"...`);

    const [response, reqErr] = await requestor.request({
        method: 'DELETE',
        path: `/dwaas-core/api/v1/spaces/${space}/${objectType.endpoint}/${objectName}`,
        params: { deleteAnyway: 'true' },
    });

    return checkResponse(response, reqErr, `Delete task chain "${objectName}"`);
}
