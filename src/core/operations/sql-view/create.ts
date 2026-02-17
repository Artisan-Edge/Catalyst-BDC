import type { CsnFile } from '../../../types/csn';
import type { AsyncResult } from '../../../types/result';
import { err } from '../../../types/result';
import type { DatasphereRequestor } from '../../../types/requestor';
import { extractObject } from '../../csn/extract';
import { checkResponse } from '../../http/checkResponse';
import { DATASPHERE_OBJECT_TYPES } from '../../../types/objectTypes';
import { debug } from '../../utils/logging';

export async function createView(
    requestor: DatasphereRequestor,
    space: string,
    csn: CsnFile,
    objectName: string,
): AsyncResult<string> {
    const objectType = DATASPHERE_OBJECT_TYPES['view'];

    const [payload, extractErr] = extractObject(csn, objectType.csnKey, objectName);
    if (extractErr) return err(extractErr);

    debug(`Creating view "${objectName}"...`);

    const [response, reqErr] = await requestor.request({
        method: 'POST',
        path: `/dwaas-core/api/v1/spaces/${space}/${objectType.endpoint}`,
        params: { saveAnyway: 'true', allowMissingDependencies: 'true', deploy: 'true' },
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });

    return checkResponse(response, reqErr, `Create view "${objectName}"`);
}
