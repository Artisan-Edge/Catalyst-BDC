import type { AsyncResult } from '../../../types/result';
import { ok, err } from '../../../types/result';
import type { CliExecutor } from '../../cli/executor';
import { DSP_OBJECT_TYPES } from '../../../types/objectTypes';
import { debug } from '../../utils/logging';

export async function readLocalTable(
    objectName: string,
    executor: CliExecutor,
): AsyncResult<string> {
    const { readCommand } = DSP_OBJECT_TYPES['local-table'];

    debug(`Reading local table "${objectName}"...`);

    const [result, execErr] = await executor.exec({
        command: readCommand,
        flags: ['--technical-name', objectName],
    });
    if (execErr) return err(execErr);

    return ok(result.stdout);
}
