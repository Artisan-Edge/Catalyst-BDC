import type { AsyncResult } from '../../../types/result';
import type { DatasphereRequestor } from '../../../types/requestor';
import type { DeleteOptions } from '../../../types/operationOptions';
import { checkResponse } from '../../http/checkResponse';
import { DATASPHERE_OBJECT_TYPES } from '../../../types/objectTypes';
import { debug } from '../../utils/logging';

// Forced by default (deleteAnyway=true), as it always was; { deleteAnyway: false } lets Datasphere refuse to
// delete a task chain something still uses
export async function deleteTaskChain(
    requestor: DatasphereRequestor,
    space: string,
    objectName: string,
    options: DeleteOptions = {},
): AsyncResult<string> {
    const objectType = DATASPHERE_OBJECT_TYPES['task-chain'];
    const deleteAnyway = options.deleteAnyway ?? true;

    debug(`Deleting task chain "${objectName}" (deleteAnyway=${deleteAnyway})...`);

    const [response, reqErr] = await requestor.request({
        method: 'DELETE',
        path: `/dwaas-core/api/v1/spaces/${space}/${objectType.endpoint}/${objectName}`,
        params: { deleteAnyway: String(deleteAnyway) },
    });

    return checkResponse(response, reqErr, `Delete task chain "${objectName}"`);
}
