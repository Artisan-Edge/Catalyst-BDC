import { z } from 'zod';
import type { AsyncResult } from '../../../types/result';
import { ok, err } from '../../../types/result';
import type { DatasphereRequestor } from '../../../types/requestor';
import { checkResponse } from '../../http/checkResponse';
import { debug } from '../../utils/logging';
import { safeJsonParse } from '../../utils/json';

// Creates a schedule through the task-framework endpoint, as verified on a tenant (2026-11-24): this body gave
// 201 {"scheduleId": "..."} and a schedule reading "uiVariant": "FORM", owned by the signed-in user. A body without
// cron or frequency is refused (400 invalidScheduleBodyError); an object that does not exist, 403.

const CreateResponseSchema = z.object({ scheduleId: z.string() });

export interface CreateScheduleInput {
    // TASK_CHAINS / RUN_CHAIN for a task chain
    applicationId: string;
    activity: string;
    objectId: string;
    // Five-field cron, evaluated in UTC
    cron: string;
    // Default: the object's name
    description?: string;
    // Default ENABLED
    activationStatus?: string;
}

export async function createSchedule(requestor: DatasphereRequestor, space: string, input: CreateScheduleInput): AsyncResult<{ scheduleId: string }> {
    const body = {
        applicationId: input.applicationId,
        activity: input.activity,
        objectId: input.objectId,
        description: input.description ?? input.objectId,
        cron: input.cron,
        activationStatus: input.activationStatus ?? 'ENABLED',
    };
    debug(`Creating schedule for "${input.objectId}" (${input.cron})...`);
    const [response, reqErr] = await requestor.request({
        method: 'POST',
        path: `/dwaas-core/tf/${encodeURIComponent(space)}/schedules`,
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(body),
    });
    const [text, textErr] = await checkResponse(response, reqErr, `Create schedule for "${input.objectId}"`);
    if (textErr) return err(textErr);

    const [created, parseErr] = safeJsonParse(text, CreateResponseSchema);
    if (parseErr) return err(new Error(`Create schedule for "${input.objectId}": ${parseErr.message}`));
    return ok({ scheduleId: created.scheduleId });
}
