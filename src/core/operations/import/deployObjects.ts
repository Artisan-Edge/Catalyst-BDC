import type { DatasphereRequestor } from '../../../types/requestor';
import type { AsyncResult } from '../../../types/result';
import { checkResponse } from '../../http/helpers';
import { debug } from '../../utils/logging';

export async function deployObjects(
    requestor: DatasphereRequestor,
    spaceName: string,
    spaceId: string,
    objectIds: string[],
): AsyncResult<string> {
    debug(`Deploying ${objectIds.length} objects via /dwaas-core/deploy/...`);

    const payload = {
        folderGuid: spaceId,
        objectIds,
        spaceName,
    };

    const [response, reqErr] = await requestor.request({
        method: 'POST',
        path: `/dwaas-core/deploy/${spaceName}/objects`,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });

    return checkResponse(response, reqErr, `Deploy objects (${objectIds.length})`);
}
