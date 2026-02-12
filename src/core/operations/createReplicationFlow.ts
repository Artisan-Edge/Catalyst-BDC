import type { CsnFile } from '../../types/csn';
import type { AsyncResult } from '../../types/result';
import { ok, err } from '../../types/result';
import type { CliExecutor } from '../cli/executor';
import { withTempCsn } from '../cli/tempFile';
import { extractObject } from '../csn/extract';
import { DSP_OBJECT_TYPES } from '../../types/objectTypes';
import { objectExists } from './objectExists';
import type { RunReplicationFlowResult } from './runReplicationFlow';
import { debug } from '../utils/logging';

export interface ReplicationFlowResult {
    output: string;
    action: 'created' | 'updated';
    runResult?: RunReplicationFlowResult;
}

export async function createReplicationFlow(
    csn: CsnFile,
    objectName: string,
    executor: CliExecutor,
): AsyncResult<ReplicationFlowResult> {
    const objectType = DSP_OBJECT_TYPES['replication-flow'];

    const [payload, extractErr] = extractObject(csn, objectType.csnKey, objectName);
    if (extractErr) return err(extractErr);

    const [exists, existsErr] = await objectExists(objectType.readCommand, objectName, executor);
    if (existsErr) return err(existsErr);

    const action = exists ? 'updated' : 'created';
    const command = exists ? objectType.updateCommand : objectType.command;
    debug(`${exists ? 'Updating' : 'Creating'} replication flow "${objectName}"...`);

    const [output, execErr] = await withTempCsn(payload, async (tmpFile) => {
        const [result, cmdErr] = await executor.exec({
            command,
            flags: ['--file-path', tmpFile, '--allow-missing-dependencies'],
        });
        if (cmdErr) return err(cmdErr);
        return ok(result.stdout);
    });
    if (execErr) return err(execErr);

    return ok({ output, action });
}
