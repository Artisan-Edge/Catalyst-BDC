import { z } from 'zod';
import type { AsyncResult } from '../../../types/result';
import { ok, err } from '../../../types/result';
import type { DatasphereRequestor } from '../../../types/requestor';
import { checkResponse } from '../../http/checkResponse';
import { debug } from '../../utils/logging';
import { safeJsonParse } from '../../utils/json';

// Starts a task chain run through the documented endpoint SAP's CLI calls for `tasks chains run`; the run goes on in
// the background and its log id is what readTaskLog follows
const RunResponseSchema = z.object({ logId: z.union([z.number(), z.string()]) });

export async function runTaskChain(requestor: DatasphereRequestor, space: string, chainName: string): AsyncResult<{ logId: number }> {
    debug(`Running task chain "${chainName}"...`);
    const [response, reqErr] = await requestor.request({
        method: 'POST',
        path: `/dwaas-core/api/v1/tasks/chains/${encodeURIComponent(space)}/run/${encodeURIComponent(chainName)}`,
        headers: { Accept: 'application/json' },
    });
    const [body, bodyErr] = await checkResponse(response, reqErr, `Run task chain "${chainName}"`);
    if (bodyErr) return err(bodyErr);

    const [started, parseErr] = safeJsonParse(body, RunResponseSchema);
    if (parseErr) return err(new Error(`Run task chain "${chainName}": ${parseErr.message}`));
    const logId = Number(started.logId);
    if (!Number.isFinite(logId)) return err(new Error(`Run task chain "${chainName}": log id ${String(started.logId)} is not a number`));
    return ok({ logId });
}
