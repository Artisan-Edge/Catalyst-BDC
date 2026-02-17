import type { TokenCache } from './types';
import type { OAuthTokens } from '../core/auth/oauth';
import type { AsyncResult } from '../types/result';
import { ok, err } from '../types/result';
import { saveCachedTokens } from '../core/auth/tokenCache';
import { refreshAccessToken, TOKEN_EXPIRY_BUFFER_SEC } from '../core/http/refreshAccessToken';
import { debug } from '../core/utils/logging';

export interface EnsureAccessTokenResult {
    accessToken: string;
    tokenCache: TokenCache;
    csrfInvalidated: boolean;
}

export async function ensureAccessToken(
    tokenCache: TokenCache | null,
    host: string,
): AsyncResult<EnsureAccessTokenResult> {
    if (!tokenCache) {
        return err(new Error('Not authenticated — call login() first or provide tokens in config'));
    }

    const nowSec = Math.floor(Date.now() / 1000);
    if (tokenCache.expiresAfter > nowSec + TOKEN_EXPIRY_BUFFER_SEC) {
        return ok({ accessToken: tokenCache.accessToken, tokenCache, csrfInvalidated: false });
    }

    // Token expired — refresh
    debug('Access token expired, refreshing...');
    const [refreshed, refreshErr] = await refreshAccessToken(
        tokenCache.tokenUrl,
        tokenCache.refreshToken,
        tokenCache.clientId,
        tokenCache.clientSecret,
    );
    if (refreshErr) return err(refreshErr);

    const updatedCache: TokenCache = {
        ...tokenCache,
        accessToken: refreshed.accessToken,
        expiresAfter: refreshed.expiresAfter,
    };

    saveCachedTokens(host, updatedCache as OAuthTokens);

    return ok({ accessToken: refreshed.accessToken, tokenCache: updatedCache, csrfInvalidated: true });
}
