import type { CsnFile } from '../../../types/csn';
import type { AsyncResult } from '../../../types/result';
import { ok, err } from '../../../types/result';
import type { DatasphereRequestor } from '../../../types/requestor';
import { objectExists } from '../objectExists';
import { createAnalyticModel } from './create';
import { updateAnalyticModel } from './update';

export interface UpsertAnalyticModelResult {
    output: string;
    action: 'created' | 'updated';
}

export async function upsertAnalyticModel(
    requestor: DatasphereRequestor,
    space: string,
    csn: CsnFile,
    objectName: string,
): AsyncResult<UpsertAnalyticModelResult> {
    const [exists, existsErr] = await objectExists(requestor, space, 'analytic-model', objectName);
    if (existsErr) return err(existsErr);

    if (exists) {
        const [output, updateErr] = await updateAnalyticModel(requestor, space, csn, objectName);
        if (updateErr) return err(updateErr);
        return ok({ output, action: 'updated' });
    }

    const [output, createErr] = await createAnalyticModel(requestor, space, csn, objectName);
    if (createErr) return err(createErr);
    return ok({ output, action: 'created' });
}
