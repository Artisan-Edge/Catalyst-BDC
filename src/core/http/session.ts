import { z } from 'zod';
import type { AsyncResult } from '../../types/result';
import { ok, err } from '../../types/result';
import { debug } from '../utils/logging';
import { safeJsonParse } from '../utils/json';

const tokenResponseSchema = z.object({
    access_token: z.string(),
    expires_in: z.number(),
});

export const TOKEN_EXPIRY_BUFFER_SEC = 60;

export interface AccessTokenResult {
    accessToken: string;
    expiresAfter: number;
}

export interface SessionData {
    accessToken: string;
    csrf: string;
    cookies: string;
}

export async function refreshAccessToken(
    tokenUrl: string,
    refreshToken: string,
    clientId: string,
    clientSecret: string,
): AsyncResult<AccessTokenResult> {
    debug('Refreshing access token...');

    const params = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: clientId,
        client_secret: clientSecret,
    });

    const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
    });

    if (!response.ok) {
        const body = await response.text();
        return err(new Error(`Token refresh failed (${response.status}): ${body}`));
    }

    const body = await response.text();
    const [tokenData, parseErr] = safeJsonParse(body, tokenResponseSchema);
    if (parseErr) return err(parseErr);

    const expiresAfter = Math.floor(Date.now() / 1000) + tokenData.expires_in;
    debug('Token refreshed, expires in', tokenData.expires_in, 'seconds');
    return ok({ accessToken: tokenData.access_token, expiresAfter });
}

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
