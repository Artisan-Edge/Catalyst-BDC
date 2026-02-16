import type { AsyncResult } from '../../../types/result';
import { ok, err } from '../../../types/result';
import type { CliExecutor } from '../../cli/executor';
import { debug } from '../../utils/logging';

export async function deleteLocalTable(
    objectName: string,
    executor: CliExecutor,
): AsyncResult<string> {
    debug(`Deleting local table "${objectName}"...`);

    const [result, execErr] = await executor.exec({
        command: 'objects local-tables delete',
        flags: ['--technical-name', objectName, '--force'],
    });
    if (execErr) return err(execErr);

    return ok(result.stdout);
}
