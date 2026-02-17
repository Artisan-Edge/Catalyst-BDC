import type { BdcConfig } from '../types/config';
import type { TokenCache, CsrfCache } from './types';
import type { OAuthTokens } from '../core/auth/oauth';
import type { AsyncResult } from '../types/result';
import { ok, err } from '../types/result';
import { loadCachedTokens, saveCachedTokens } from '../core/auth/tokenCache';
import { refreshAccessToken, TOKEN_EXPIRY_BUFFER_SEC } from '../core/http/refreshAccessToken';
import { fetchCsrf } from '../core/http/fetchCsrf';
import { login as coreLogin } from '../core/operations/login';
import { debug } from '../core/utils/logging';

export interface ClientLoginResult {
    tokens: OAuthTokens;
    tokenCache: TokenCache;
    csrfCache: CsrfCache;
}

export async function clientLogin(
    config: BdcConfig,
    currentTokenCache: TokenCache | null,
): AsyncResult<ClientLoginResult> {
    // Try cached tokens first
    const [cached] = loadCachedTokens(config.host);
    if (cached) {
        const nowSec = Math.floor(Date.now() / 1000);

        if (cached.expiresAfter > nowSec + TOKEN_EXPIRY_BUFFER_SEC) {
            debug('Using cached tokens (still valid)');

            const [csrfResult, csrfErr] = await fetchCsrf(config.host, cached.accessToken);
            if (!csrfErr) {
                return ok({ tokens: cached, tokenCache: cached, csrfCache: csrfResult });
            }
            debug('Cached token CSRF failed, will try refresh');
        }

        // Token expired but we have refresh token — try refresh
        debug('Cached access token expired, refreshing...');
        const [refreshed, refreshErr] = await refreshAccessToken(
            cached.tokenUrl, cached.refreshToken, cached.clientId, cached.clientSecret,
        );
        if (!refreshErr) {
            const tokens: OAuthTokens = {
                ...cached,
                accessToken: refreshed.accessToken,
                expiresAfter: refreshed.expiresAfter,
            };
            saveCachedTokens(config.host, tokens);

            const [csrfResult, csrfErr] = await fetchCsrf(config.host, tokens.accessToken);
            if (!csrfErr) {
                return ok({ tokens, tokenCache: tokens, csrfCache: csrfResult });
            }
            debug('Refreshed token CSRF failed, will do full login');
        } else {
            debug('Token refresh failed:', refreshErr.message);
        }
    }

    // Full browser login
    const [tokens, loginErr] = await coreLogin(config);
    if (loginErr) return err(loginErr);

    const tokenCache: TokenCache = {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresAfter: tokens.expiresAfter,
        tokenUrl: tokens.tokenUrl,
        clientId: tokens.clientId,
        clientSecret: tokens.clientSecret,
    };

    saveCachedTokens(config.host, tokens);

    // Fetch initial CSRF
    const [csrfResult, csrfErr] = await fetchCsrf(config.host, tokens.accessToken);
    if (csrfErr) return err(csrfErr);

    return ok({ tokens, tokenCache, csrfCache: csrfResult });
}
