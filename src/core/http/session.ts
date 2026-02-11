import { z } from 'zod';
import type { AsyncResult } from '../../types/result';
import { ok, err } from '../../types/result';
import { spawnAsync } from '../cli/executor';
import { debug } from '../utils/logging';
import { safeJsonParse } from '../utils/json';

const tokenResponseSchema = z.object({
    access_token: z.string(),
    expires_in: z.number(),
});

export const TOKEN_EXPIRY_BUFFER_SEC = 60;

const storedSecretsSchema = z.object({
    client_id: z.string(),
    client_secret: z.string(),
    token_url: z.string(),
    access_token: z.string(),
    refresh_token: z.string(),
    expires_after: z.number(),
});

// CLI output can be a single object or an array
const storedSecretsFromCliSchema = z.preprocess(
    (val) => (Array.isArray(val) ? val[0] : val),
    storedSecretsSchema,
);

type StoredSecrets = z.infer<typeof storedSecretsSchema>;

export interface AccessTokenResult {
    accessToken: string;
    expiresAfter: number;
}

export interface SessionData {
    accessToken: string;
    csrf: string;
    cookies: string;
}

export async function getAccessToken(host: string): AsyncResult<AccessTokenResult> {
    // Read stored secrets from the CLI's credential store
    const result = await spawnAsync('npx', [
        'datasphere', 'config', 'secrets', 'show',
        '--host', host,
    ]);

    if (result.code !== 0) {
        return err(new Error(
            `Failed to read stored secrets (exit ${result.code}): ${result.stderr || result.stdout}`,
        ));
    }

    const [secrets, parseErr] = safeJsonParse(result.stdout, storedSecretsFromCliSchema);
    if (parseErr) return err(parseErr);

    // Check if token is still valid (with 60s buffer)
    const nowSec = Math.floor(Date.now() / 1000);
    if (secrets.expires_after > nowSec + TOKEN_EXPIRY_BUFFER_SEC) {
        debug('Access token still valid, expires in', secrets.expires_after - nowSec, 'seconds');
        return ok({ accessToken: secrets.access_token, expiresAfter: secrets.expires_after });
    }

    // Token expired — refresh it
    debug('Access token expired, refreshing...');
    const params = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: secrets.refresh_token,
        client_id: secrets.client_id,
        client_secret: secrets.client_secret,
    });

    const response = await fetch(secrets.token_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
    });

    if (!response.ok) {
        const body = await response.text();
        return err(new Error(`Token refresh failed (${response.status}): ${body}`));
    }

    const body = await response.text();
    const [tokenData, tokenParseErr] = safeJsonParse(body, tokenResponseSchema);
    if (tokenParseErr) return err(tokenParseErr);

    const expiresAfter = Math.floor(Date.now() / 1000) + tokenData.expires_in;
    debug('Token refreshed successfully, expires in', tokenData.expires_in, 'seconds');
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
