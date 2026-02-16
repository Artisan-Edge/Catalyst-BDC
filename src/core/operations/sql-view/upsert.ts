import type { CsnFile } from '../../../types/csn';
import type { AsyncResult } from '../../../types/result';
import { ok, err } from '../../../types/result';
import type { CliExecutor } from '../../cli/executor';
import { DSP_OBJECT_TYPES } from '../../../types/objectTypes';
import { objectExists } from '../objectExists';
import { createView } from './create';
import { updateView } from './update';

export interface UpsertViewResult {
    output: string;
    action: 'created' | 'updated';
}

export async function upsertView(
    csn: CsnFile,
    objectName: string,
    executor: CliExecutor,
): AsyncResult<UpsertViewResult> {
    const { readCommand } = DSP_OBJECT_TYPES['view'];

    const [exists, existsErr] = await objectExists(readCommand, objectName, executor);
    if (existsErr) return err(existsErr);

    if (exists) {
        const [output, updateErr] = await updateView(csn, objectName, executor);
        if (updateErr) return err(updateErr);
        return ok({ output, action: 'updated' });
    }

    const [output, createErr] = await createView(csn, objectName, executor);
    if (createErr) return err(createErr);
    return ok({ output, action: 'created' });
}
