import type { CsnFile } from '../../../types/csn';
import type { DatasphereRequestor } from '../../../types/requestor';
import type { AsyncResult } from '../../../types/result';
import { ok, err } from '../../../types/result';
import { debug } from '../../utils/logging';
import { safeJsonParse } from '../../utils/json';
import { z } from 'zod';

// Response shape: { "id": { "OBJ_NAME": { "id": "GUID" }, ... } }
const ImportResponseSchema = z.object({
    id: z.record(z.string(), z.object({ id: z.string() })),
});

export interface ImportCsnResult {
    body: string;
    objectIds: string[];
}

export async function importCsn(
    requestor: DatasphereRequestor,
    spaceName: string,
    spaceId: string,
    csn: CsnFile,
): AsyncResult<ImportCsnResult> {
    const definitionCount = Object.keys(csn.definitions ?? {}).length;
    debug(`Importing CSN with ${definitionCount} definitions via /deepsea/repository/...`);

    const payload = {
        data: {
            content: csn,
            saveAction: 'import',
            async: false,
            name: 'batch-import.json',
            space_id: spaceId,
            customValidationOptions: { allowBackwardTransitions: true },
        },
    };

    const [response, reqErr] = await requestor.request({
        method: 'POST',
        path: `/deepsea/repository/${spaceName}/objects/`,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    });

    if (reqErr) return err(reqErr);
    if (!response) return err(new Error(`Import CSN: No response`));

    const body = await response.text();

    if (!response.ok) {
        return err(new Error(`Import CSN (${definitionCount} definitions): HTTP ${response.status} — ${body.substring(0, 500)}`));
    }

    // Extract object GUIDs from response
    const [parsed, parseErr] = safeJsonParse(body, ImportResponseSchema);
    if (parseErr) {
        debug(`Import succeeded but could not parse object IDs: ${parseErr.message}`);
        return ok({ body, objectIds: [] });
    }

    const objectIds = Object.values(parsed.id).map(entry => entry.id);
    debug(`Imported ${objectIds.length} objects: ${objectIds.join(', ')}`);

    return ok({ body, objectIds });
}
