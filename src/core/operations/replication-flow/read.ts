import type { AsyncResult } from '../../../types/result';
import type { DatasphereRequestor } from '../../../types/requestor';
import { checkResponse } from '../../http/helpers';
import { DATASPHERE_OBJECT_TYPES } from '../../../types/objectTypes';
import { debug } from '../../utils/logging';

export async function readReplicationFlow(
    requestor: DatasphereRequestor,
    space: string,
    objectName: string,
): AsyncResult<string> {
    const objectType = DATASPHERE_OBJECT_TYPES['replication-flow'];

    debug(`Reading replication flow "${objectName}"...`);

    const [response, reqErr] = await requestor.request({
        method: 'GET',
        path: `/dwaas-core/api/v1/spaces/${space}/${objectType.endpoint}/${objectName}`,
    });

    return checkResponse(response, reqErr, `Read replication flow "${objectName}"`);
}
