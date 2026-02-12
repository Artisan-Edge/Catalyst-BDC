import type { CsnFile } from '../../types/csn';
import type { AsyncResult } from '../../types/result';
import { ok, err } from '../../types/result';
import type { CliExecutor } from '../cli/executor';
import { withTempCsn } from '../cli/tempFile';
import { extractObject } from '../csn/extract';
import { DSP_OBJECT_TYPES } from '../../types/objectTypes';
import { objectExists } from './objectExists';
import { debug } from '../utils/logging';

export interface LocalTableResult {
    output: string;
    action: 'created' | 'skipped';
}

export async function createLocalTable(
    csn: CsnFile,
    objectName: string,
    executor: CliExecutor,
): AsyncResult<LocalTableResult> {
    const objectType = DSP_OBJECT_TYPES['local-table'];

    const [payload, extractErr] = extractObject(csn, objectType.csnKey, objectName);
    if (extractErr) return err(extractErr);

    const [exists, existsErr] = await objectExists(objectType.readCommand, objectName, executor);
    if (existsErr) return err(existsErr);

    if (exists) {
        debug(`Local table "${objectName}" already exists, skipping.`);
        return ok({ output: 'already exists', action: 'skipped' });
    }

    debug(`Creating local table "${objectName}"...`);

    const [output, execErr] = await withTempCsn(payload, async (tmpFile) => {
        const [result, cmdErr] = await executor.exec({
            command: objectType.command,
            flags: ['--file-path', tmpFile, '--allow-missing-dependencies'],
        });
        if (cmdErr) return err(cmdErr);
        return ok(result.stdout);
    });
    if (execErr) return err(execErr);

    return ok({ output, action: 'created' });
}
