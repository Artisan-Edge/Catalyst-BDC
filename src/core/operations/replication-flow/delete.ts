import type { AsyncResult } from '../../../types/result';
import { ok, err } from '../../../types/result';
import type { CliExecutor } from '../../cli/executor';
import { debug } from '../../utils/logging';

export async function deleteReplicationFlow(
    objectName: string,
    executor: CliExecutor,
): AsyncResult<string> {
    debug(`Deleting replication flow "${objectName}"...`);

    const [result, execErr] = await executor.exec({
        command: 'objects replication-flows delete',
        flags: ['--technical-name', objectName, '--force'],
    });
    if (execErr) return err(execErr);

    return ok(result.stdout);
}
