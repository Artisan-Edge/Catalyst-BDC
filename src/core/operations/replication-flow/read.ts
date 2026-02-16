import type { AsyncResult } from '../../../types/result';
import { ok, err } from '../../../types/result';
import type { CliExecutor } from '../../cli/executor';
import { DSP_OBJECT_TYPES } from '../../../types/objectTypes';
import { debug } from '../../utils/logging';

export async function readReplicationFlow(
    objectName: string,
    executor: CliExecutor,
): AsyncResult<string> {
    const { readCommand } = DSP_OBJECT_TYPES['replication-flow'];

    debug(`Reading replication flow "${objectName}"...`);

    const [result, execErr] = await executor.exec({
        command: readCommand,
        flags: ['--technical-name', objectName],
    });
    if (execErr) return err(execErr);

    return ok(result.stdout);
}
