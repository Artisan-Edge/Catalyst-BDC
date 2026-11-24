import type { AsyncResult } from '../../../types/result';
import type { DatasphereRequestor } from '../../../types/requestor';
import type { DeleteOptions } from '../../../types/operationOptions';
import { checkResponse } from '../../http/checkResponse';
import { DATASPHERE_OBJECT_TYPES } from '../../../types/objectTypes';
import { debug } from '../../utils/logging';

// Not forced by default (deleteAnyway=false): Datasphere refuses to delete a control something still uses
export async function deleteDataAccessControl(
    requestor: DatasphereRequestor,
    space: string,
    objectName: string,
    options: DeleteOptions = {},
): AsyncResult<string> {
    const objectType = DATASPHERE_OBJECT_TYPES['data-access-control'];
    const deleteAnyway = options.deleteAnyway ?? false;

    debug(`Deleting data access control "${objectName}" (deleteAnyway=${deleteAnyway})...`);

    const [response, reqErr] = await requestor.request({
        method: 'DELETE',
        path: `/dwaas-core/api/v1/spaces/${encodeURIComponent(space)}/${objectType.endpoint}/${encodeURIComponent(objectName)}`,
        params: { deleteAnyway: String(deleteAnyway) },
    });

    return checkResponse(response, reqErr, `Delete data access control "${objectName}"`);
}
