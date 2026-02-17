import type { TokenCache, CsrfCache } from './types';
import type { DatasphereRequestOptions } from '../types/requestor';
import type { AsyncResult } from '../types/result';
import { ok, err } from '../types/result';
import { ensureAccessToken } from './ensureAccessToken';
import { ensureCsrf } from './ensureCsrf';
import { buildDatasphereUrl } from '../core/http/buildDatasphereUrl';
import { debug } from '../core/utils/logging';

export interface RequestState {
    tokenCache: TokenCache | null;
    csrfCache: CsrfCache | null;
}

export interface ExecuteRequestResult {
    response: Response;
    state: RequestState;
}

export async function executeRequest(
    host: string,
    state: RequestState,
    options: DatasphereRequestOptions,
): AsyncResult<ExecuteRequestResult> {
    const [tokenResult, tokenErr] = await ensureAccessToken(state.tokenCache, host);
    if (tokenErr) return err(tokenErr);

    let currentState: RequestState = {
        tokenCache: tokenResult.tokenCache,
        csrfCache: tokenResult.csrfInvalidated ? null : state.csrfCache,
    };

    const { accessToken } = tokenResult;
    const isMutation = options.method !== 'GET' && options.method !== 'HEAD';

    // Mutations need CSRF
    let csrf: CsrfCache | null = null;
    if (isMutation) {
        const [csrfResult, csrfErr] = await ensureCsrf(currentState.csrfCache, host, accessToken);
        if (csrfErr) return err(csrfErr);
        csrf = csrfResult;
        currentState = { ...currentState, csrfCache: csrf };
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

    const response = await fetch(url, {
        method: options.method,
        headers,
        body: options.body,
    });

    // CSRF retry on 403
    if (response.status === 403 && isMutation) {
        debug('Got 403, retrying with fresh CSRF token...');

        const [freshCsrf, freshCsrfErr] = await ensureCsrf(null, host, accessToken);
        if (freshCsrfErr) return err(freshCsrfErr);

        headers['X-Csrf-Token'] = freshCsrf.csrf;
        headers['Cookie'] = freshCsrf.cookies;

        const retryResponse = await fetch(url, {
            method: options.method,
            headers,
            body: options.body,
        });

        return ok({ response: retryResponse, state: { ...currentState, csrfCache: freshCsrf } });
    }

    return ok({ response, state: currentState });
}
