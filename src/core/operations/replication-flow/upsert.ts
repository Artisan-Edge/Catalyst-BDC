import type { CsnFile } from '../../../types/csn';
import type { AsyncResult } from '../../../types/result';
import { ok, err } from '../../../types/result';
import type { DatasphereRequestor } from '../../../types/requestor';
import { objectExists } from '../objectExists';
import { createReplicationFlow } from './create';
import { updateReplicationFlow } from './update';

export interface UpsertReplicationFlowResult {
    output: string;
    action: 'created' | 'updated';
}

export async function upsertReplicationFlow(
    requestor: DatasphereRequestor,
    space: string,
    csn: CsnFile,
    objectName: string,
): AsyncResult<UpsertReplicationFlowResult> {
    const [exists, existsErr] = await objectExists(requestor, space, 'replication-flow', objectName);
    if (existsErr) return err(existsErr);

    if (exists) {
        const [output, updateErr] = await updateReplicationFlow(requestor, space, csn, objectName);
        if (updateErr) return err(updateErr);
        return ok({ output, action: 'updated' });
    }

    const [output, createErr] = await createReplicationFlow(requestor, space, csn, objectName);
    if (createErr) return err(createErr);
    return ok({ output, action: 'created' });
}
