import type { CsnFile } from '../../../types/csn';
import type { AsyncResult } from '../../../types/result';
import { ok, err } from '../../../types/result';
import type { CliExecutor } from '../../cli/executor';
import { withTempCsn } from '../../cli/tempFile';
import { extractObject } from '../../csn/extract';
import { DSP_OBJECT_TYPES } from '../../../types/objectTypes';
import { debug } from '../../utils/logging';

export async function updateReplicationFlow(
    csn: CsnFile,
    objectName: string,
    executor: CliExecutor,
): AsyncResult<string> {
    const objectType = DSP_OBJECT_TYPES['replication-flow'];

    const [payload, extractErr] = extractObject(csn, objectType.csnKey, objectName);
    if (extractErr) return err(extractErr);

    debug(`Updating replication flow "${objectName}"...`);

    return withTempCsn(payload, async (tmpFile) => {
        const [result, execErr] = await executor.exec({
            command: objectType.updateCommand,
            flags: ['--file-path', tmpFile, '--allow-missing-dependencies'],
        });
        if (execErr) return err(execErr);
        return ok(result.stdout);
    });
}
