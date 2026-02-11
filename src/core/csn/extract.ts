import type { CsnFile } from '../../types/csn';
import type { Result } from '../../types/result';
import { ok, err } from '../../types/result';

// Extract single object from CSN (API accepts one per request)
export function extractObject(csn: CsnFile, csnKey: string, objectName: string): Result<CsnFile, Error> {
    const collection = csn[csnKey];
    if (!collection || typeof collection !== 'object') {
        return err(new Error(
            `Key "${csnKey}" not found in CSN file. Available keys: ${Object.keys(csn).join(', ')}`,
        ));
    }

    const record = collection as Record<string, unknown>;
    const definition = record[objectName];
    if (!definition) {
        return err(new Error(
            `Object "${objectName}" not found under "${csnKey}". Available: ${Object.keys(record).join(', ')}`,
        ));
    }

    return ok({
        [csnKey]: { [objectName]: definition },
        version: csn.version,
        meta: csn.meta,
        $version: csn.$version,
    });
}
