import type { AsyncResult } from '../../../types/result';
import type { DatasphereRequestor } from '../../../types/requestor';
import { checkResponse } from '../../http/helpers';
import { DATASPHERE_OBJECT_TYPES } from '../../../types/objectTypes';
import { debug } from '../../utils/logging';

export async function deleteView(
    requestor: DatasphereRequestor,
    space: string,
    objectName: string,
): AsyncResult<string> {
    const objectType = DATASPHERE_OBJECT_TYPES['view'];

    debug(`Deleting view "${objectName}"...`);

    const [response, reqErr] = await requestor.request({
        method: 'DELETE',
        path: `/dwaas-core/api/v1/spaces/${space}/${objectType.endpoint}/${objectName}`,
        params: { deleteAnyway: 'true' },
    });

    return checkResponse(response, reqErr, `Delete view "${objectName}"`);
}
