import type { AsyncResult } from '../../../types/result';
import type { DatasphereRequestor } from '../../../types/requestor';
import { checkResponse } from '../../http/checkResponse';
import { DATASPHERE_OBJECT_TYPES } from '../../../types/objectTypes';
import { debug } from '../../utils/logging';

export async function deleteReplicationFlow(
    requestor: DatasphereRequestor,
    space: string,
    objectName: string,
): AsyncResult<string> {
    const objectType = DATASPHERE_OBJECT_TYPES['replication-flow'];

    debug(`Deleting replication flow "${objectName}"...`);

    const [response, reqErr] = await requestor.request({
        method: 'DELETE',
        path: `/dwaas-core/api/v1/spaces/${space}/${objectType.endpoint}/${objectName}`,
        params: { deleteAnyway: 'true' },
    });

    return checkResponse(response, reqErr, `Delete replication flow "${objectName}"`);
}
