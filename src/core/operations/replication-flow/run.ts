import { z } from 'zod';
import type { BdcConfig } from '../../../types/config';
import type { AsyncResult } from '../../../types/result';
import { ok, err } from '../../../types/result';
import type { SessionData } from '../../http/session';
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
    flowName: string,
    config: BdcConfig,
    session: SessionData,
): AsyncResult<RunReplicationFlowResult> {
    const url = `${config.host}/dwaas-core/replicationflow/space/${config.space}/flows/${flowName}/run`;
    debug('POST', url);

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${session.accessToken}`,
            'Content-Type': 'application/json',
            'X-Csrf-Token': session.csrf,
            'X-Requested-With': 'XMLHttpRequest',
            'Cookie': session.cookies,
        },
        body: JSON.stringify({ isDirect: true }),
    });

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
