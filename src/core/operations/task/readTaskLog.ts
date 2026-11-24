import { z } from 'zod';
import type { AsyncResult } from '../../../types/result';
import { ok, err } from '../../../types/result';
import type { DatasphereRequestor } from '../../../types/requestor';
import { checkResponse } from '../../http/checkResponse';
import { debug } from '../../utils/logging';
import { safeJsonParse } from '../../utils/json';

// One task run's log through the documented endpoint SAP's CLI calls for `tasks logs get`. Seen on a tenant
// (2026-11-24, a task chain run): logId, status (COMPLETED, RUNNING, FAILED), startTime, endTime, runTime, objectId,
// applicationId, activity, spaceId, user, children (one per task: nodeId, logId, status, objectId, ...), messages
// (messageNumber, severity, text, timestamp).

const ChildSchema = z.object({ objectId: z.string().nullish(), status: z.string().nullish(), logId: z.union([z.number(), z.string()]).nullish() }).passthrough();
const MessageSchema = z.object({ severity: z.string().nullish(), text: z.string().nullish() }).passthrough();
const LogSchema = z.object({
    logId: z.union([z.number(), z.string()]).nullish(),
    status: z.string(),
    startTime: z.string().nullish(),
    endTime: z.string().nullish(),
    runTime: z.number().nullish(),
    objectId: z.string().nullish(),
    children: z.array(ChildSchema).default([]),
    messages: z.array(MessageSchema).default([]),
}).passthrough();

export interface TaskLog {
    logId: number;
    status: string;
    startTime: string | null;
    endTime: string | null;
    // Milliseconds
    runTime: number | null;
    objectId: string | null;
    children: { objectId: string; status: string }[];
    messages: { severity: string; text: string }[];
}

export async function readTaskLog(requestor: DatasphereRequestor, space: string, logId: number): AsyncResult<TaskLog> {
    debug(`Reading task log ${logId}...`);
    const [response, reqErr] = await requestor.request({
        method: 'GET',
        path: `/dwaas-core/api/v1/tasks/logs/${encodeURIComponent(space)}/${logId}`,
        headers: { Accept: 'application/json' },
    });
    const [body, bodyErr] = await checkResponse(response, reqErr, `Read task log ${logId}`);
    if (bodyErr) return err(bodyErr);

    const [log, parseErr] = safeJsonParse(body, LogSchema);
    if (parseErr) return err(new Error(`Read task log ${logId}: ${parseErr.message}`));
    return ok({
        logId,
        status: log.status,
        startTime: log.startTime ?? null,
        endTime: log.endTime ?? null,
        runTime: log.runTime ?? null,
        objectId: log.objectId ?? null,
        children: log.children.map(child => ({ objectId: child.objectId ?? '', status: child.status ?? '' })),
        messages: log.messages.map(message => ({ severity: message.severity ?? '', text: message.text ?? '' })),
    });
}
