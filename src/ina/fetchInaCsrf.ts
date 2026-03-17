import type { AsyncResult } from '../types/result';
import { ok, err } from '../types/result';
import { buildDatasphereUrl } from '../core/http/helpers';
import { debug } from '../core/utils/logging';
import { INA_CSRF_PATH } from './types';

export interface InaCsrfToken {
    csrf: string;
    cookies: string;
}

/**
 * Fetches a CSRF token from the INA endpoint itself.
 * The INA service requires its own CSRF token — the standard
 * Datasphere CSRF from /api/v1/csrf does NOT work for INA POSTs.
 */
export async function fetchInaCsrf(
    host: string,
    accessToken: string,
): AsyncResult<InaCsrfToken> {
    const url = buildDatasphereUrl(host, INA_CSRF_PATH);
    debug(`INA CSRF: fetching from ${INA_CSRF_PATH}`);

    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'X-Csrf-Token': 'Fetch',
            'X-Requested-With': 'XMLHttpRequest',
        },
    });

    if (!response.ok) {
        return err(new Error(`INA CSRF fetch failed: HTTP ${response.status}`));
    }

    const csrf = response.headers.get('x-csrf-token');
    if (!csrf) {
        return err(new Error('INA CSRF fetch: no x-csrf-token header in response'));
    }

    const cookies = response.headers.get('set-cookie') ?? '';
    debug('INA CSRF: acquired');

    return ok({ csrf, cookies });
}
