import { z } from 'zod';
import type { AsyncResult } from '../../../types/result';
import { ok, err } from '../../../types/result';
import type { DatasphereRequestor } from '../../../types/requestor';
import { checkResponse } from '../../http/checkResponse';
import { debug } from '../../utils/logging';
import { safeJsonParse } from '../../utils/json';

// The signed-in user's Datasphere user name (EBOSCH), the name a schedule's owner is given in; the OAuth token holds
// only the e-mail. Read from the session endpoint the Datasphere shell calls when it starts (verified 2026-11-24:
// {"user": {"userName": "EBOSCH", ...}, ...}). Null when the response has none.
const SessionSchema = z.object({ user: z.object({ userName: z.string().nullish() }).passthrough().nullish() }).passthrough();

export async function readCurrentUser(requestor: DatasphereRequestor): AsyncResult<string | null> {
    debug('Reading the signed-in user name...');
    const [response, reqErr] = await requestor.request({
        method: 'GET',
        path: '/sap/fpa/services/rest/epm/session',
        params: { action: 'logon' },
        headers: { Accept: 'application/json' },
    });
    const [body, bodyErr] = await checkResponse(response, reqErr, 'Read the signed-in user');
    if (bodyErr) return err(bodyErr);

    const [session, parseErr] = safeJsonParse(body, SessionSchema);
    if (parseErr) return err(new Error(`Read the signed-in user: ${parseErr.message}`));
    return ok(session.user?.userName ?? null);
}
