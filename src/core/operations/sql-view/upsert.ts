import type { CsnFile } from '../../../types/csn';
import type { AsyncResult } from '../../../types/result';
import { ok, err } from '../../../types/result';
import type { DatasphereRequestor } from '../../../types/requestor';
import { objectExists } from '../objectExists';
import { createView } from './create';
import { updateView } from './update';

export interface UpsertViewResult {
    output: string;
    action: 'created' | 'updated';
}

export async function upsertView(
    requestor: DatasphereRequestor,
    space: string,
    csn: CsnFile,
    objectName: string,
): AsyncResult<UpsertViewResult> {
    const [exists, existsErr] = await objectExists(requestor, space, 'view', objectName);
    if (existsErr) return err(existsErr);

    if (exists) {
        const [output, updateErr] = await updateView(requestor, space, csn, objectName);
        if (updateErr) return err(updateErr);
        return ok({ output, action: 'updated' });
    }

    const [output, createErr] = await createView(requestor, space, csn, objectName);
    if (createErr) return err(createErr);
    return ok({ output, action: 'created' });
}
