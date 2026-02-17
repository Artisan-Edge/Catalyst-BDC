import type { CsnFile } from '../../../types/csn';
import type { AsyncResult } from '../../../types/result';
import { ok, err } from '../../../types/result';
import type { DatasphereRequestor } from '../../../types/requestor';
import { objectExists } from '../objectExists';
import { createLocalTable } from './create';
import { updateLocalTable } from './update';

export interface UpsertLocalTableResult {
    output: string;
    action: 'created' | 'updated';
}

export async function upsertLocalTable(
    requestor: DatasphereRequestor,
    space: string,
    csn: CsnFile,
    objectName: string,
): AsyncResult<UpsertLocalTableResult> {
    const [exists, existsErr] = await objectExists(requestor, space, 'local-table', objectName);
    if (existsErr) return err(existsErr);

    if (exists) {
        const [output, updateErr] = await updateLocalTable(requestor, space, csn, objectName);
        if (updateErr) return err(updateErr);
        return ok({ output, action: 'updated' });
    }

    const [output, createErr] = await createLocalTable(requestor, space, csn, objectName);
    if (createErr) return err(createErr);
    return ok({ output, action: 'created' });
}
