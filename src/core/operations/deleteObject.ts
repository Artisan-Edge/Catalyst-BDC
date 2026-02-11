import type { AsyncResult } from '../../types/result';
import { ok, err } from '../../types/result';
import type { CliExecutor } from '../cli/executor';
import { debug } from '../utils/logging';

export type DeletableObjectType = 'local-table' | 'replication-flow' | 'view';

const DELETE_COMMANDS: Record<DeletableObjectType, string> = {
    'view': 'objects views delete',
    'local-table': 'objects local-tables delete',
    'replication-flow': 'objects replication-flows delete',
};

export async function deleteObject(
    objectType: DeletableObjectType,
    technicalName: string,
    executor: CliExecutor,
): AsyncResult<string> {
    const command = DELETE_COMMANDS[objectType];

    debug(`Deleting ${objectType} "${technicalName}"...`);
    const [result, execErr] = await executor.exec({
        command,
        flags: ['--technical-name', technicalName, '--force'],
    });
    if (execErr) return err(execErr);
    return ok(result.stdout);
}
