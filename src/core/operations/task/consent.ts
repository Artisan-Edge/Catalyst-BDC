import { z } from 'zod';
import type { AsyncResult } from '../../../types/result';
import { ok, err } from '../../../types/result';
import type { DatasphereRequestor } from '../../../types/requestor';
import { checkResponse } from '../../http/checkResponse';
import { debug } from '../../utils/logging';
import { safeJsonParse } from '../../utils/json';

// The signed-in user's consent to run tasks on their behalf (what a schedule they own needs), through the documented
// endpoint SAP's CLI calls for `tasks consent get`. Seen on a tenant (2026-11-24): {"status": "CONSENT_GIVEN",
// "createdAt": "...", "validUntil": "..."}; the discovery document names the expiry validTo, so both are read.
// Nobody can read another user's consent.

const ConsentSchema = z.object({
    status: z.string(),
    createdAt: z.string().nullish(),
    validUntil: z.string().nullish(),
    validTo: z.string().nullish(),
});

export interface TaskConsent {
    // CONSENT_GIVEN, NO_CONSENT or CONSENT_EXPIRED
    status: string;
    createdAt: string | null;
    validUntil: string | null;
}

export async function readTaskConsent(requestor: DatasphereRequestor): AsyncResult<TaskConsent> {
    debug('Reading the task consent of the signed-in user...');
    const [response, reqErr] = await requestor.request({
        method: 'GET',
        path: '/dwaas-core/api/v1/tasks/consent',
        headers: { Accept: 'application/json' },
    });
    const [body, bodyErr] = await checkResponse(response, reqErr, 'Read task consent');
    if (bodyErr) return err(bodyErr);

    const [consent, parseErr] = safeJsonParse(body, ConsentSchema);
    if (parseErr) return err(new Error(`Read task consent: ${parseErr.message}`));
    return ok({ status: consent.status, createdAt: consent.createdAt ?? null, validUntil: consent.validUntil ?? consent.validTo ?? null });
}
