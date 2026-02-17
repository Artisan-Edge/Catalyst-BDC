import { z } from 'zod';
import type { AsyncResult } from '../../../types/result';
import { ok, err } from '../../../types/result';
import type { DatasphereRequestor } from '../../../types/requestor';
import { debug } from '../../utils/logging';
import { safeJsonParse } from '../../utils/json';

const runResponseSchema = z.object({
    runStatus: z.string(),
});

export interface RunReplicationFlowResult {
    status: number;
    runStatus: string;
}

export async function runReplicationFlow(
    requestor: DatasphereRequestor,
    space: string,
    flowName: string,
): AsyncResult<RunReplicationFlowResult> {
    debug(`Running replication flow "${flowName}"...`);

    const [response, reqErr] = await requestor.request({
        method: 'POST',
        path: `/dwaas-core/replicationflow/space/${space}/flows/${flowName}/run`,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDirect: true }),
    });

    if (reqErr) return err(reqErr);
    if (!response) return err(new Error(`Run replication flow "${flowName}": No response`));

    const body = await response.text();
    debug('Run response:', response.status, body);

    if (response.ok) {
        const [parsed, parseErr] = safeJsonParse(body, runResponseSchema);
        if (parseErr) return err(parseErr);
        return ok({ status: response.status, runStatus: parsed.runStatus });
    }

    if (response.status === 409) {
        return err(new Error(`Replication flow "${flowName}" is already running (409 Conflict)`));
    }
    if (response.status === 401) {
        return err(new Error(`Authentication failed (401) — OAuth session may need to be re-established via login`));
    }

    return err(new Error(`Run replication flow failed (${response.status}): ${body}`));
}
