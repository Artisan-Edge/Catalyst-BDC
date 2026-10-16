import http from 'node:http';
import { randomBytes } from 'node:crypto';
import { exec } from 'node:child_process';
import path from 'node:path';
import { z } from 'zod';
import type { OAuthConfig } from '../../types/config';
import type { AsyncResult, Result } from '../../types/result';
import { ok, err } from '../../types/result';
import { safeJsonParse } from '../utils/json';
import { debug } from '../utils/logging';

const tokenResponseSchema = z.object({
    access_token: z.string(),
    refresh_token: z.string(),
    expires_in: z.number(),
});

const optionsFileSchema = z.object({
    'client-id': z.string(),
    'client-secret': z.string(),
    'authorization-url': z.string().url(),
    'token-url': z.string().url(),
});

const LOGIN_TIMEOUT_MS = 5 * 60 * 1000;

export interface OAuthTokens {
    accessToken: string;
    refreshToken: string;
    expiresAfter: number;
    tokenUrl: string;
    clientId: string;
    clientSecret: string;
}

async function resolveOAuthConfig(oauth: OAuthConfig | { optionsFile: string }): AsyncResult<OAuthConfig> {
    if ('clientId' in oauth) return ok(oauth);

    const resolved = path.resolve(oauth.optionsFile);
    const file = Bun.file(resolved);
    if (!(await file.exists())) {
        return err(new Error(`OAuth options file not found: ${resolved}`));
    }

    const raw = await file.text();
    const [parsed, parseErr] = safeJsonParse(raw, optionsFileSchema);
    if (parseErr) return err(parseErr);

    return ok({
        clientId: parsed['client-id'],
        clientSecret: parsed['client-secret'],
        authorizationUrl: parsed['authorization-url'],
        tokenUrl: parsed['token-url'],
    });
}

// SAP Datasphere CLI convention: sb- prefixed = custom client (port 8080), otherwise pre-delivered (port 65000)
function getDefaultPort(clientId: string): number {
    const envPort = process.env['CLI_HTTP_PORT'];
    if (envPort) return parseInt(envPort, 10);
    return clientId.startsWith('sb-') ? 8080 : 65000;
}

function openBrowser(url: string): void {
    const cmd = process.platform === 'win32'
        ? `start "" "${url}"`
        : process.platform === 'darwin'
            ? `open "${url}"`
            : `xdg-open "${url}"`;

    exec(cmd, (error) => {
        if (error) debug('Failed to open browser:', error.message);
    });
}

export async function performOAuthLogin(
    oauth: OAuthConfig | { optionsFile: string },
): AsyncResult<OAuthTokens> {
    const [config, configErr] = await resolveOAuthConfig(oauth);
    if (configErr) return err(configErr);

    const state = randomBytes(16).toString('hex');
    const port = getDefaultPort(config.clientId);

    const [callbackResult, callbackErr] = await waitForCallback(config, state, port);
    if (callbackErr) return err(callbackErr);

    return ok(callbackResult);
}

function waitForCallback(
    config: OAuthConfig,
    state: string,
    port: number,
): AsyncResult<OAuthTokens> {
    const redirectUri = `http://localhost:${port}`;

    return new Promise((resolve) => {
        let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

        const server = http.createServer(async (req, res) => {
            const url = new URL(req.url ?? '/', redirectUri);

            const code = url.searchParams.get('code');
            const returnedState = url.searchParams.get('state');

            if (!code) {
                res.writeHead(400);
                res.end('Missing authorization code');
                return;
            }

            if (returnedState && returnedState !== state) {
                res.writeHead(400);
                res.end('Invalid callback — state mismatch');
                settle(err(new Error('OAuth callback: state mismatch')));
                return;
            }

            // Exchange code for tokens
            const [tokens, tokenErr] = await exchangeCodeForTokens(config, code, redirectUri);

            if (tokenErr) {
                res.writeHead(500);
                res.end('Token exchange failed');
                settle(err(tokenErr));
                return;
            }

            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end('<html><body><h2>Login successful</h2><p>You can close this tab.</p></body></html>');
            settle(ok(tokens));
        });

        // Every exit path routes through here. Clearing the timer is what lets the
        // CLI exit: a pending timeout holds the event loop open, so a successful
        // login would otherwise hang at the prompt until the timeout fires.
        const settle = (result: Result<OAuthTokens>): void => {
            if (timeoutHandle) clearTimeout(timeoutHandle);
            server.close();
            resolve(result);
        };

        server.listen(port, 'localhost', () => {
            // Match SAP CLI behavior: only send response_type, client_id, and state
            const authUrl = new URL(config.authorizationUrl);
            authUrl.searchParams.set('response_type', 'code');
            authUrl.searchParams.set('client_id', config.clientId);
            authUrl.searchParams.set('state', state);

            debug('Opening browser for OAuth login...');
            debug('Redirect URI:', redirectUri);
            debug('Auth URL:', authUrl.toString());
            openBrowser(authUrl.toString());
        });

        server.on('error', (e) => {
            settle(err(new Error(`Failed to start OAuth callback server on port ${port}: ${e.message}`)));
        });

        timeoutHandle = setTimeout(() => {
            settle(err(new Error(
                `OAuth login timed out. Did you maintain the redirect URI as ${redirectUri} in SAP Datasphere?`,
            )));
        }, LOGIN_TIMEOUT_MS);
    });
}

async function exchangeCodeForTokens(
    config: OAuthConfig,
    code: string,
    redirectUri: string,
): AsyncResult<OAuthTokens> {
    const params = new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        client_id: config.clientId,
        client_secret: config.clientSecret,
    });

    debug('Exchanging authorization code for tokens...');

    const response = await fetch(config.tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
    });

    if (!response.ok) {
        const body = await response.text();
        return err(new Error(`Token exchange failed (${response.status}): ${body}`));
    }

    const body = await response.text();
    const [tokenData, parseErr] = safeJsonParse(body, tokenResponseSchema);
    if (parseErr) return err(parseErr);

    const expiresAfter = Math.floor(Date.now() / 1000) + tokenData.expires_in;

    return ok({
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        expiresAfter,
        tokenUrl: config.tokenUrl,
        clientId: config.clientId,
        clientSecret: config.clientSecret,
    });
}
