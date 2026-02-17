import { describe, test, expect } from 'bun:test';
import { createTestClient, createTestConfig } from './testHelpers';
import { createClient } from '../../client';
import type { BdcClient } from '../../client';

describe('auth / login', () => {
    let client: BdcClient;

    test('login with OAuth config returns tokens', async () => {
        client = createTestClient();
        const [tokens, loginErr] = await client.login();
        if (loginErr) console.error('Login failed:', loginErr.message);
        expect(loginErr).toBeNull();
        expect(tokens).not.toBeNull();
        expect(tokens!.accessToken).toBeTruthy();
        expect(tokens!.refreshToken).toBeTruthy();
        expect(tokens!.expiresAfter).toBeGreaterThan(0);
    }, 120_000);

    test('operations work after login (CSRF acquired)', async () => {
        // Reading a non-existent view should fail with a Datasphere error (400/404)
        // but NOT with an auth error (401/403) — proves CSRF is working
        const [, readErr] = await client.readView('__NONEXISTENT__');
        expect(readErr).not.toBeNull();
        expect(readErr!.message).not.toContain('401');
        expect(readErr!.message).not.toContain('403');
        expect(readErr!.message).not.toContain('Not authenticated');
    }, 30_000);

    test('TokenConfig skips login — operations work directly', async () => {
        // First login to get valid tokens
        const freshClient = createTestClient();
        const [tokens, loginErr] = await freshClient.login();
        if (loginErr) throw new Error(`Login failed: ${loginErr.message}`);

        // Create a new client with pre-provided tokens (no login needed)
        const config = createTestConfig();
        const [tokenClient, clientErr] = createClient({
            ...config,
            tokens: {
                accessToken: tokens!.accessToken,
                refreshToken: tokens!.refreshToken,
                tokenUrl: tokens!.tokenUrl,
                clientId: tokens!.clientId,
                clientSecret: tokens!.clientSecret,
                expiresAfter: tokens!.expiresAfter,
            },
        });
        expect(clientErr).toBeNull();

        // Should work without calling login()
        const [, readErr] = await tokenClient!.readView('__NONEXISTENT__');
        expect(readErr).not.toBeNull();
        expect(readErr!.message).not.toContain('401');
        expect(readErr!.message).not.toContain('Not authenticated');
    }, 120_000);
});
