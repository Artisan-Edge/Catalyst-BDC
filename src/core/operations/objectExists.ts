import type { AsyncResult } from '../../types/result';
import { ok } from '../../types/result';
import type { CliExecutor } from '../cli/executor';
import { debug } from '../utils/logging';

export async function objectExists(
    readCommand: string,
    technicalName: string,
    executor: CliExecutor,
): AsyncResult<boolean> {
    const [, execErr] = await executor.exec({
        command: readCommand,
        flags: ['--technical-name', technicalName],
        quiet: true,
    });

    if (!execErr) {
        debug(`"${technicalName}" exists`);
        return ok(true);
    }

    debug(`"${technicalName}" does not exist`);
    return ok(false);
}
