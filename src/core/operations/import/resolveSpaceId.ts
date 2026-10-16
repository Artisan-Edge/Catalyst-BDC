import type { DatasphereRequestor } from '../../../types/requestor';
import type { AsyncResult } from '../../../types/result';
import { ok, err } from '../../../types/result';
import { debug } from '../../utils/logging';
import { z } from 'zod';
import { safeJsonParse } from '../../utils/json';

const DesignObjectsSchema = z.object({
    results: z.array(z.object({
        space_id: z.string(),
    }).passthrough()).min(1),
});

export async function resolveSpaceId(
    requestor: DatasphereRequestor,
    spaceName: string,
): AsyncResult<string> {
    debug(`Resolving space UUID for "${spaceName}"...`);

    const [response, reqErr] = await requestor.request({
        method: 'GET',
        path: `/deepsea/repository/${spaceName}/designObjects`,
        headers: { 'Accept': 'application/json' },
    });

    if (reqErr) return err(reqErr);
    if (!response) return err(new Error(`resolveSpaceId: No response`));

    const body = await response.text();

    if (!response.ok) {
        return err(new Error(`resolveSpaceId: HTTP ${response.status} — ${body.substring(0, 500)}`));
    }

    const [parsed, parseErr] = safeJsonParse(body, DesignObjectsSchema);
    if (parseErr) return err(new Error(`resolveSpaceId: Failed to parse response — ${parseErr.message}`));

    const spaceId = parsed.results[0]!.space_id;
    debug(`Resolved space UUID: ${spaceId}`);
    return ok(spaceId);
}
