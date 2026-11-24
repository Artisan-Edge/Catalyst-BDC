import { z } from 'zod';
import type { AsyncResult } from '../../../types/result';
import { ok, err } from '../../../types/result';
import type { DatasphereRequestor } from '../../../types/requestor';
import { checkResponse } from '../../http/checkResponse';
import { debug } from '../../utils/logging';
import { safeJsonParse } from '../../utils/json';

// The schedules of a space through Datasphere's internal task-framework endpoint (/dwaas-core/tf, undocumented; the
// Data Builder's own). Seen on a tenant (2026-11-24): scheduleId, externalScheduleId, spaceId, applicationId,
// activity, objectId, description, activationStatus, cron, createdBy, createdAt, changedBy, changedAt, owner,
// uiVariant, principalType, nextRun. No time zone field (the cron is evaluated in UTC) and no consent field (the
// owner's consent to run tasks is readable only by the owner: readTaskConsent).

const ScheduleSchema = z.object({
    scheduleId: z.string(),
    spaceId: z.string().nullish(),
    applicationId: z.string().nullish(),
    activity: z.string().nullish(),
    objectId: z.string(),
    description: z.string().nullish(),
    activationStatus: z.string().nullish(),
    cron: z.string().nullish(),
    owner: z.string().nullish(),
    changedBy: z.string().nullish(),
    changedAt: z.string().nullish(),
    nextRun: z.string().nullish(),
}).passthrough();
const ListResponseSchema = z.array(ScheduleSchema);
const TIME_ZONE_KEY = /^time_?zone$/i;

export interface TaskSchedule {
    scheduleId: string;
    spaceId: string | null;
    // TASK_CHAINS for a task chain
    applicationId: string | null;
    // RUN_CHAIN for a task chain
    activity: string | null;
    objectId: string;
    description: string | null;
    // ENABLED, or paused
    activationStatus: string | null;
    // Null when the schedule is defined by a frequency instead
    cron: string | null;
    // A time zone field when the record carries one (none seen on a tenant: the cron is then UTC)
    timezone: string | null;
    // The user the schedule runs as (its creator)
    owner: string | null;
    changedBy: string | null;
    changedAt: string | null;
    nextRun: string | null;
}

function timezoneOf(record: Record<string, unknown>): string | null {
    const key = Object.keys(record).find(name => TIME_ZONE_KEY.test(name));
    const value = key ? record[key] : undefined;
    return typeof value === 'string' && value.length > 0 ? value : null;
}

export function toSchedule(record: z.infer<typeof ScheduleSchema>): TaskSchedule {
    return {
        scheduleId: record.scheduleId,
        spaceId: record.spaceId ?? null,
        applicationId: record.applicationId ?? null,
        activity: record.activity ?? null,
        objectId: record.objectId,
        description: record.description ?? null,
        activationStatus: record.activationStatus ?? null,
        cron: record.cron ?? null,
        timezone: timezoneOf(record),
        owner: record.owner ?? null,
        changedBy: record.changedBy ?? null,
        changedAt: record.changedAt ?? null,
        nextRun: record.nextRun ?? null,
    };
}

// Every schedule of the space (every application: task chains, flows, views)
export async function listSchedules(requestor: DatasphereRequestor, space: string): AsyncResult<TaskSchedule[]> {
    debug(`Listing schedules in space "${space}"...`);
    const [response, reqErr] = await requestor.request({
        method: 'GET',
        path: `/dwaas-core/tf/${encodeURIComponent(space)}/schedules`,
        headers: { Accept: 'application/json' },
    });
    const [body, bodyErr] = await checkResponse(response, reqErr, 'List schedules');
    if (bodyErr) return err(bodyErr);

    const [records, parseErr] = safeJsonParse(body, ListResponseSchema);
    if (parseErr) return err(new Error(`List schedules: ${parseErr.message}`));
    return ok(records.map(toSchedule));
}
