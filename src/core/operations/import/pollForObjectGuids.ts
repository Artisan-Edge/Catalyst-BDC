import { z } from 'zod';
import type { DatasphereRequestor } from '../../../types/requestor';
import type { AsyncResult } from '../../../types/result';
import { ok, err } from '../../../types/result';
import { safeJsonParse } from '../../utils/json';
import { debug } from '../../utils/logging';

const POLL_INTERVAL_MS = 10_000;
const MAX_POLL_ATTEMPTS = 60;

const DesignObjectsSchema = z.object({
    results: z.array(z.object({
        space_id: z.string(),
        id: z.string(),
        name: z.string(),
    }).passthrough()),
});

interface PollResult {
    objectIds: string[];
    foundNames: string[];
}

async function fetchDesignObjects(
    requestor: DatasphereRequestor,
    spaceName: string,
    targetNames: Set<string>,
): AsyncResult<Map<string, string>> {
    const [response, reqErr] = await requestor.request({
        method: 'GET',
        path: `/deepsea/repository/${spaceName}/designObjects`,
        headers: { 'Accept': 'application/json' },
    });

    if (reqErr) return err(reqErr);
    if (!response) return err(new Error('pollForObjectGuids: No response from designObjects'));

    const body = await response.text();
    if (!response.ok) return err(new Error(`pollForObjectGuids: HTTP ${response.status} — ${body.substring(0, 500)}`));

    const [parsed, parseErr] = safeJsonParse(body, DesignObjectsSchema);
    if (parseErr) return err(new Error(`pollForObjectGuids: parse failed — ${parseErr.message}`));

    const found = new Map<string, string>();
    for (const obj of parsed.results) {
        if (targetNames.has(obj.name)) found.set(obj.name, obj.id);
    }

    return ok(found);
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export async function pollForObjectGuids(
    requestor: DatasphereRequestor,
    spaceName: string,
    definitionNames: string[],
): AsyncResult<PollResult> {
    const targetNames = new Set(definitionNames);
    const targetCount = targetNames.size;

    debug(`Polling designObjects for ${targetCount} definitions (max ${MAX_POLL_ATTEMPTS} attempts, ${POLL_INTERVAL_MS / 1000}s interval)...`);

    for (let attempt = 1; attempt <= MAX_POLL_ATTEMPTS; attempt++) {
        await sleep(POLL_INTERVAL_MS);

        const [found, fetchErr] = await fetchDesignObjects(requestor, spaceName, targetNames);
        if (fetchErr) return err(fetchErr);

        const pct = Math.round((found.size / targetCount) * 100);
        debug(`Poll ${attempt}/${MAX_POLL_ATTEMPTS}: ${found.size}/${targetCount} definitions found (${pct}%)`);

        if (found.size < targetCount) continue;

        const objectIds = Array.from(found.values());
        const foundNames = Array.from(found.keys());
        return ok({ objectIds, foundNames });
    }

    // Timed out — do a final check to report what's missing
    const [lastCheck] = await fetchDesignObjects(requestor, spaceName, targetNames);
    const foundSet = lastCheck ? new Set(lastCheck.keys()) : new Set<string>();
    const missing = definitionNames.filter(n => !foundSet.has(n));

    return err(new Error(
        `pollForObjectGuids: timed out after ${MAX_POLL_ATTEMPTS * POLL_INTERVAL_MS / 1000}s. ` +
        `Missing ${missing.length}/${targetCount} definitions: ${missing.slice(0, 10).join(', ')}` +
        (missing.length > 10 ? ` ... and ${missing.length - 10} more` : ''),
    ));
}
