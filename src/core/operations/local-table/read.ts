import type { AsyncResult } from '../../../types/result';
import type { DatasphereRequestor } from '../../../types/requestor';
import { checkResponse } from '../../http/checkResponse';
import { DATASPHERE_OBJECT_TYPES } from '../../../types/objectTypes';
import { debug } from '../../utils/logging';

export async function readLocalTable(
    requestor: DatasphereRequestor,
    space: string,
    objectName: string,
): AsyncResult<string> {
    const objectType = DATASPHERE_OBJECT_TYPES['local-table'];

    debug(`Reading local table "${objectName}"...`);

    const [response, reqErr] = await requestor.request({
        method: 'GET',
        path: `/dwaas-core/api/v1/spaces/${space}/${objectType.endpoint}/${objectName}`,
    });

    return checkResponse(response, reqErr, `Read local table "${objectName}"`);
}
