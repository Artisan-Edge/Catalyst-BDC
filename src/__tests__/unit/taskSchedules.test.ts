import { describe, it, expect } from 'bun:test';
import { listSchedules, createSchedule, deleteSchedule, readTaskConsent, runTaskChain, readTaskLog, readCurrentUser } from '../../index';
import type { DatasphereRequestor, DatasphereRequestOptions } from '../../index';
import { ok } from '../../types/result';

// The responses are the tenant's own (MadibaDemo, 2026-11-24), shortened

const SCHEDULE = {
    scheduleId: '74acf23a-1695-4142-b773-2f5d9a851625', externalScheduleId: 'b6406e8b-54f8-42aa-940e-b88d948bbfc5', spaceId: 'ARTISANHANA',
    applicationId: 'TASK_CHAINS', activity: 'RUN_CHAIN', objectId: 'PAR_ART_ZSNAP_AUTH_FEED', description: 'PAR_ART_ZSNAP_AUTH_FEED',
    activationStatus: 'ENABLED', cron: '0 * * * *', createdBy: 'EBOSCH', createdAt: '2026-11-24T18:43:53.049Z', changedBy: 'EBOSCH',
    changedAt: '2026-11-24T18:43:53.049Z', owner: 'EBOSCH', uiVariant: 'FORM', principalType: 'BUSINESS', nextRun: '2026-11-24T20:00:00.000Z',
};

function fakeRequestor(status: number, body: unknown): { requestor: DatasphereRequestor; sent: DatasphereRequestOptions[] } {
    const sent: DatasphereRequestOptions[] = [];
    const requestor: DatasphereRequestor = {
        request: async options => {
            sent.push(options);
            return ok(new Response(body === null ? null : JSON.stringify(body), { status }));
        },
    };
    return { requestor, sent };
}

describe('schedules', () => {
    it('lists the space\'s schedules from the task-framework endpoint; no time zone field means none', async () => {
        const { requestor, sent } = fakeRequestor(200, [SCHEDULE]);
        const [schedules, error] = await listSchedules(requestor, 'ARTISANHANA');
        expect(error).toBeNull();
        expect(sent[0]).toMatchObject({ method: 'GET', path: '/dwaas-core/tf/ARTISANHANA/schedules' });
        expect(schedules).toEqual([{ scheduleId: SCHEDULE.scheduleId, spaceId: 'ARTISANHANA', applicationId: 'TASK_CHAINS', activity: 'RUN_CHAIN', objectId: 'PAR_ART_ZSNAP_AUTH_FEED', description: 'PAR_ART_ZSNAP_AUTH_FEED', activationStatus: 'ENABLED', cron: '0 * * * *', timezone: null, owner: 'EBOSCH', changedBy: 'EBOSCH', changedAt: SCHEDULE.changedAt, nextRun: SCHEDULE.nextRun }]);
    });

    it('reads a time zone field when a record carries one', async () => {
        const { requestor } = fakeRequestor(200, [{ ...SCHEDULE, timeZone: 'Europe/Berlin' }]);
        const [schedules] = await listSchedules(requestor, 'ARTISANHANA');
        expect(schedules?.[0]?.timezone).toBe('Europe/Berlin');
    });

    it('creates with the verified body and returns the schedule id; deletes by id', async () => {
        const created = fakeRequestor(201, { scheduleId: 'new-id' });
        const [result, error] = await createSchedule(created.requestor, 'ARTISANHANA', { applicationId: 'TASK_CHAINS', activity: 'RUN_CHAIN', objectId: 'PAR_ART_ZSNAP_AUTH_FEED', cron: '0 * * * *' });
        expect(error).toBeNull();
        expect(result).toEqual({ scheduleId: 'new-id' });
        expect(created.sent[0]).toMatchObject({ method: 'POST', path: '/dwaas-core/tf/ARTISANHANA/schedules' });
        expect(JSON.parse(created.sent[0]?.body ?? '{}')).toEqual({ applicationId: 'TASK_CHAINS', activity: 'RUN_CHAIN', objectId: 'PAR_ART_ZSNAP_AUTH_FEED', description: 'PAR_ART_ZSNAP_AUTH_FEED', cron: '0 * * * *', activationStatus: 'ENABLED' });

        const deleted = fakeRequestor(204, null);
        const [, deleteError] = await deleteSchedule(deleted.requestor, 'ARTISANHANA', 'new-id');
        expect(deleteError).toBeNull();
        expect(deleted.sent[0]).toMatchObject({ method: 'DELETE', path: '/dwaas-core/tf/ARTISANHANA/schedules/new-id' });
    });

    it('a refused create is an error carrying the status and body', async () => {
        const { requestor } = fakeRequestor(400, { code: 'invalidScheduleBodyError' });
        const [, error] = await createSchedule(requestor, 'ARTISANHANA', { applicationId: 'TASK_CHAINS', activity: 'RUN_CHAIN', objectId: 'X', cron: '' });
        expect(error?.message).toContain('HTTP 400');
        expect(error?.message).toContain('invalidScheduleBodyError');
    });
});

describe('task consent, runs and logs', () => {
    it('consent: validUntil as the tenant answers, validTo as the discovery document names it', async () => {
        const [given] = await readTaskConsent(fakeRequestor(200, { status: 'CONSENT_GIVEN', createdAt: '2026-02-12T20:54:32.000Z', validUntil: '2027-02-12T20:54:32.000Z' }).requestor);
        expect(given).toEqual({ status: 'CONSENT_GIVEN', createdAt: '2026-02-12T20:54:32.000Z', validUntil: '2027-02-12T20:54:32.000Z' });
        const [documented] = await readTaskConsent(fakeRequestor(200, { status: 'CONSENT_GIVEN', validTo: '2027-01-01T00:00:00.000Z' }).requestor);
        expect(documented?.validUntil).toBe('2027-01-01T00:00:00.000Z');
        const [none] = await readTaskConsent(fakeRequestor(200, { status: 'NO_CONSENT' }).requestor);
        expect(none).toEqual({ status: 'NO_CONSENT', createdAt: null, validUntil: null });
    });

    it('runs a chain and reads its log, children and messages', async () => {
        const run = fakeRequestor(200, { logId: 15898 });
        const [started] = await runTaskChain(run.requestor, 'ARTISANHANA', 'PAR_ART_ZSNAP_AUTH_FEED');
        expect(started).toEqual({ logId: 15898 });
        expect(run.sent[0]).toMatchObject({ method: 'POST', path: '/dwaas-core/api/v1/tasks/chains/ARTISANHANA/run/PAR_ART_ZSNAP_AUTH_FEED' });

        const log = fakeRequestor(200, {
            logId: 15898, status: 'COMPLETED', startTime: '2026-11-24T19:00:01.820Z', endTime: '2026-11-24T19:02:23.732Z', runTime: 141912, objectId: 'PAR_ART_ZSNAP_AUTH_FEED',
            applicationId: 'TASK_CHAINS', activity: 'RUN_CHAIN', spaceId: 'ARTISANHANA', user: 'Egan Bosch',
            children: [{ nodeId: 1, logId: 15901, status: 'COMPLETED', objectId: 'PAR_ART_ZSNAP_AuthUser_Replication' }],
            messages: [{ messageNumber: 1, severity: 'INFO', text: 'Task 15898 started.', timestamp: '2026-11-24T19:00:01.823Z' }],
        });
        const [read] = await readTaskLog(log.requestor, 'ARTISANHANA', 15898);
        expect(log.sent[0]).toMatchObject({ method: 'GET', path: '/dwaas-core/api/v1/tasks/logs/ARTISANHANA/15898' });
        expect(read).toEqual({ logId: 15898, status: 'COMPLETED', startTime: '2026-11-24T19:00:01.820Z', endTime: '2026-11-24T19:02:23.732Z', runTime: 141912, objectId: 'PAR_ART_ZSNAP_AUTH_FEED', children: [{ objectId: 'PAR_ART_ZSNAP_AuthUser_Replication', status: 'COMPLETED' }], messages: [{ severity: 'INFO', text: 'Task 15898 started.' }] });
    });

    it('the signed-in user name from the session; null when absent', async () => {
        const named = fakeRequestor(200, { user: { userName: 'EBOSCH', metadata: {} }, tenant: [] });
        const [user] = await readCurrentUser(named.requestor);
        expect(user).toBe('EBOSCH');
        expect(named.sent[0]).toMatchObject({ method: 'GET', path: '/sap/fpa/services/rest/epm/session', params: { action: 'logon' } });
        const [unknown] = await readCurrentUser(fakeRequestor(200, { tenant: [] }).requestor);
        expect(unknown).toBeNull();
    });
});
