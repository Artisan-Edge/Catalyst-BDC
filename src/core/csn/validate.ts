import { z } from 'zod';
import type { CsnFile } from '../../types/csn';
import type { Result } from '../../types/result';
import { ok, err } from '../../types/result';

const csnFileSchema = z.object({
    definitions: z.record(z.string(), z.unknown()).optional(),
    replicationflows: z.record(z.string(), z.unknown()).optional(),
    version: z.object({ csn: z.string() }).optional(),
    meta: z.object({ creator: z.string() }).optional(),
    $version: z.string().optional(),
}).passthrough();

export function validateCsnFile(data: unknown): Result<CsnFile, Error> {
    const parsed = csnFileSchema.safeParse(data);
    if (!parsed.success) {
        return err(new Error(`Invalid CSN structure: ${parsed.error.message}`));
    }

    const csn = parsed.data as CsnFile;

    const hasDefinitions = csn.definitions && Object.keys(csn.definitions).length > 0;
    const hasReplicationFlows = csn.replicationflows && Object.keys(csn.replicationflows).length > 0;

    if (!hasDefinitions && !hasReplicationFlows) {
        return err(new Error('CSN file must contain at least one "definitions" or "replicationflows" entry'));
    }

    return ok(csn);
}
