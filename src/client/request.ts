import type { CsrfCache } from './types';
import type { DatasphereRequestOptions } from '../types/requestor';
import type { AsyncResult } from '../types/result';
import { ok, err } from '../types/result';
import { buildDatasphereUrl } from '../core/http/buildDatasphereUrl';
import { debug } from '../core/utils/logging';
import { safeFetch } from '../core/utils/fetch';

// Auth state lives on the client, so concurrent requests share one token refresh and one CSRF fetch
export interface RequestAuth {
    accessToken(): AsyncResult<string>;
    csrf(accessToken: string): AsyncResult<CsrfCache>;
    // Forget `stale` so the next csrf() fetches a new token; a newer cached token is left alone
    invalidateCsrf(stale: CsrfCache): void;
}

export async function executeRequest(
    host: string,
    auth: RequestAuth,
    options: DatasphereRequestOptions,
): AsyncResult<Response> {
    const [accessToken, tokenErr] = await auth.accessToken();
    if (tokenErr) return err(tokenErr);

    const isMutation = options.method !== 'GET' && options.method !== 'HEAD';

    // Mutations need CSRF
    let csrf: CsrfCache | null = null;
    if (isMutation) {
        const [csrfResult, csrfErr] = await auth.csrf(accessToken);
        if (csrfErr) return err(csrfErr);
        csrf = csrfResult;
    }

    const url = buildDatasphereUrl(host, options.path, options.params);
    debug(options.method, url);

    const headers: Record<string, string> = {
        'Authorization': `Bearer ${accessToken}`,
        'X-Requested-With': 'XMLHttpRequest',
        ...options.headers,
    };

    // Datasphere API requires explicit Accept header for GET requests
    if (!isMutation && !headers['Accept']) {
        headers['Accept'] = 'application/vnd.sap.datasphere.object.content+json';
    }

    if (csrf) {
        headers['X-Csrf-Token'] = csrf.csrf;
        headers['Cookie'] = csrf.cookies;
    }

    const [response, fetchErr] = await safeFetch(url, {
        method: options.method,
        headers,
        body: options.body,
    });
    if (fetchErr) return err(fetchErr);

    // CSRF retry on 403
    if (response.status !== 403 || !csrf) return ok(response);

    debug('Got 403, retrying with fresh CSRF token...');
    auth.invalidateCsrf(csrf);

    const [freshCsrf, freshCsrfErr] = await auth.csrf(accessToken);
    if (freshCsrfErr) return err(freshCsrfErr);

    headers['X-Csrf-Token'] = freshCsrf.csrf;
    headers['Cookie'] = freshCsrf.cookies;

    const [retryResponse, retryErr] = await safeFetch(url, {
        method: options.method,
        headers,
        body: options.body,
    });
    if (retryErr) return err(retryErr);

    return ok(retryResponse);
}
