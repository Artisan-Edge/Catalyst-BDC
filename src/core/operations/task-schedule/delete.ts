import type { AsyncResult } from '../../../types/result';
import { ok, err } from '../../../types/result';
import type { DatasphereRequestor } from '../../../types/requestor';
import { checkResponse } from '../../http/checkResponse';
import { debug } from '../../utils/logging';

// DELETE /dwaas-core/tf/<space>/schedules/<scheduleId> -> 204 (verified on a tenant, 2026-11-24)
export async function deleteSchedule(requestor: DatasphereRequestor, space: string, scheduleId: string): AsyncResult<void> {
    debug(`Deleting schedule "${scheduleId}"...`);
    const [response, reqErr] = await requestor.request({
        method: 'DELETE',
        path: `/dwaas-core/tf/${encodeURIComponent(space)}/schedules/${encodeURIComponent(scheduleId)}`,
    });
    const [, deleteErr] = await checkResponse(response, reqErr, `Delete schedule "${scheduleId}"`);
    if (deleteErr) return err(deleteErr);
    return ok(undefined);
}
