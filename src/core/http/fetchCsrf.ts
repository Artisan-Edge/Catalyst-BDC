import type { AsyncResult } from '../../types/result';
import { ok, err } from '../../types/result';
import { debug } from '../utils/logging';

export async function fetchCsrf(
    host: string,
    accessToken: string,
): AsyncResult<{ csrf: string; cookies: string }> {
    const response = await fetch(`${host}/api/v1/csrf`, {
        method: 'HEAD',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'X-Csrf-Token': 'Fetch',
            'X-Requested-With': 'XMLHttpRequest',
        },
    });

    if (!response.ok) {
        return err(new Error(`CSRF fetch failed (${response.status})`));
    }

    const csrf = response.headers.get('x-csrf-token');
    if (!csrf) {
        return err(new Error('No x-csrf-token header in CSRF response'));
    }

    const cookies = response.headers.getSetCookie().map(c => c.split(';')[0]).join('; ');
    debug('CSRF token acquired, cookies:', cookies ? 'present' : 'none');

    return ok({ csrf, cookies });
}
