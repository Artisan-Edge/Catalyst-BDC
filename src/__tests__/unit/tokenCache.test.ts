import { describe, it, expect, beforeAll, afterAll } from 'bun:test';
import os from 'node:os';
import path from 'node:path';
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import type { OAuthTokens } from '../../core/auth/oauth';

// TOKEN_FILE is resolved from the home directory at import time, so point home at a temp dir first
const tempHome = mkdtempSync(path.join(os.tmpdir(), 'catalyst-bdc-tokens-'));
const savedEnv = { HOME: process.env['HOME'], USERPROFILE: process.env['USERPROFILE'] };
let tokenCache: typeof import('../../core/auth/tokenCache');

function tokensFor(n: number): OAuthTokens {
    return {
        accessToken: `access-${n}`,
        refreshToken: `refresh-${n}`,
        expiresAfter: 1_000 + n,
        tokenUrl: 'https://idp.example/token',
        clientId: 'client',
        clientSecret: 'secret',
    };
}

beforeAll(async () => {
    process.env['HOME'] = tempHome;
    process.env['USERPROFILE'] = tempHome;
    tokenCache = await import('../../core/auth/tokenCache');
});

afterAll(() => {
    process.env['HOME'] = savedEnv.HOME;
    process.env['USERPROFILE'] = savedEnv.USERPROFILE;
    rmSync(tempHome, { recursive: true, force: true });
});

describe('tokenCache', () => {
    it('keeps every entry when many hosts save concurrently', async () => {
        const hosts = Array.from({ length: 20 }, (_, i) => `https://host${i}.example`);

        await Promise.all(hosts.map((host, i) => tokenCache.saveCachedTokens(host, tokensFor(i))));

        for (const [i, host] of hosts.entries()) {
            const [tokens, error] = await tokenCache.loadCachedTokens(host);
            expect(error).toBeNull();
            expect(tokens?.accessToken).toBe(`access-${i}`);
        }
    });

    it('leaves valid JSON and no temp files behind', () => {
        const dir = path.join(tempHome, '.catalyst-bdc');
        expect(readdirSync(dir)).toEqual(['tokens.json']);
        expect(() => JSON.parse(readFileSync(path.join(dir, 'tokens.json'), 'utf8'))).not.toThrow();
    });

    it('deletes one host without touching the others', async () => {
        expect(await tokenCache.deleteCachedTokens('https://host3.example')).toBe(true);
        expect(await tokenCache.deleteCachedTokens('https://host3.example')).toBe(false);

        const [, missing] = await tokenCache.loadCachedTokens('https://host3.example');
        const [kept] = await tokenCache.loadCachedTokens('https://host4.example');
        expect(missing).not.toBeNull();
        expect(kept?.accessToken).toBe('access-4');
    });
});
