import type { CsnFile } from '../../../types/csn';
import type { AsyncResult } from '../../../types/result';
import { ok, err } from '../../../types/result';
import type { CliExecutor } from '../../cli/executor';
import { DSP_OBJECT_TYPES } from '../../../types/objectTypes';
import { objectExists } from '../objectExists';
import { createLocalTable } from './create';
import { updateLocalTable } from './update';

export interface UpsertLocalTableResult {
    output: string;
    action: 'created' | 'updated';
}

export async function upsertLocalTable(
    csn: CsnFile,
    objectName: string,
    executor: CliExecutor,
): AsyncResult<UpsertLocalTableResult> {
    const { readCommand } = DSP_OBJECT_TYPES['local-table'];

    const [exists, existsErr] = await objectExists(readCommand, objectName, executor);
    if (existsErr) return err(existsErr);

    if (exists) {
        const [output, updateErr] = await updateLocalTable(csn, objectName, executor);
        if (updateErr) return err(updateErr);
        return ok({ output, action: 'updated' });
    }

    const [output, createErr] = await createLocalTable(csn, objectName, executor);
    if (createErr) return err(createErr);
    return ok({ output, action: 'created' });
}
