import type { CsnFile } from '../../../types/csn';
import type { AsyncResult } from '../../../types/result';
import { err } from '../../../types/result';
import type { DatasphereRequestor } from '../../../types/requestor';
import { extractObject } from '../../csn/extract';
import { checkResponse } from '../../http/helpers';
import { DATASPHERE_OBJECT_TYPES } from '../../../types/objectTypes';
import { debug } from '../../utils/logging';

export async function createLocalTable(
    requestor: DatasphereRequestor,
    space: string,
    csn: CsnFile,
    objectName: string,
): AsyncResult<string> {
    const objectType = DATASPHERE_OBJECT_TYPES['local-table'];

    const [payload, extractErr] = extractObject(csn, objectType.csnKey, objectName);
    if (extractErr) return err(extractErr);

    debug(`Creating local table "${objectName}"...`);

    const [response, reqErr] = await requestor.request({
        method: 'POST',
        path: `/dwaas-core/api/v1/spaces/${space}/${objectType.endpoint}`,
        params: { saveAnyway: 'true', allowMissingDependencies: 'true', deploy: 'true' },
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });

    return checkResponse(response, reqErr, `Create local table "${objectName}"`);
}
