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
