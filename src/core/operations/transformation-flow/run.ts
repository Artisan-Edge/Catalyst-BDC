import { z } from 'zod';
import type { AsyncResult } from '../../../types/result';
import { ok, err } from '../../../types/result';
import type { DatasphereRequestor } from '../../../types/requestor';
import { debug } from '../../utils/logging';
import { safeJsonParse } from '../../utils/json';

// ---------------------------------------------------------------------------
// !! UNVERIFIED ENDPOINT !!
//
// TODO(spike S0.2): confirm actual transformation-flow run endpoint
//
// This path has never been exercised against a live Datasphere tenant. It is
// the direct analog of the replication-flow run path
// (`/dwaas-core/replicationflow/space/{space}/flows/{name}/run`), which is the
// most plausible guess, nothing more. The request body (`{ isDirect: true }`)
// and the response shape (`{ runStatus }`) below are copied from replication
// flows on the same assumption and are equally unverified.
//
// Everything uncertain about running a transformation flow lives in this file
// and nowhere else — change it here once the spike reports back.
// ---------------------------------------------------------------------------
const RUN_ENDPOINT_TEMPLATE = (space: string, flowName: string) =>
    `/dwaas-core/transformationflow/space/${space}/flows/${flowName}/run`;

const runResponseSchema = z.object({
    runStatus: z.string(),
});

export interface RunTransformationFlowResult {
    status: number;
    runStatus: string;
}

export async function runTransformationFlow(
    requestor: DatasphereRequestor,
    space: string,
    flowName: string,
): AsyncResult<RunTransformationFlowResult> {
    debug(`Running transformation flow "${flowName}"...`);
    debug('WARNING: transformation-flow run endpoint is unverified — see TODO(spike S0.2)');

    const [response, reqErr] = await requestor.request({
        method: 'POST',
        path: RUN_ENDPOINT_TEMPLATE(space, flowName),
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDirect: true }),
    });

    if (reqErr) return err(reqErr);
    if (!response) return err(new Error(`Run transformation flow "${flowName}": No response`));

    const body = await response.text();
    debug('Run response:', response.status, body);

    if (response.ok) {
        const [parsed, parseErr] = safeJsonParse(body, runResponseSchema);
        if (parseErr) return err(parseErr);
        return ok({ status: response.status, runStatus: parsed.runStatus });
    }

    if (response.status === 409) {
        return err(new Error(`Transformation flow "${flowName}" is already running (409 Conflict)`));
    }
    if (response.status === 401) {
        return err(new Error(`Authentication failed (401) — OAuth session may need to be re-established via login`));
    }

    return err(new Error(`Run transformation flow failed (${response.status}): ${body}`));
}
