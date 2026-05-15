import path from 'node:path';
import os from 'node:os';
import { z } from 'zod';
import type { OAuthTokens } from './oauth';
import type { AsyncResult } from '../../types/result';
import { ok, err } from '../../types/result';
import { safeJsonParse } from '../utils/json';
import { debug } from '../utils/logging';

const TOKEN_FILE = path.join(os.homedir(), '.catalyst-bdc', 'tokens.json');

const cachedTokensSchema = z.record(z.string(), z.object({
    accessToken: z.string(),
    refreshToken: z.string(),
    expiresAfter: z.number(),
    tokenUrl: z.string(),
    clientId: z.string(),
    clientSecret: z.string(),
}));

type TokenStore = z.infer<typeof cachedTokensSchema>;

function hostKey(host: string): string {
    return new URL(host).hostname;
}

async function readStore(): Promise<TokenStore> {
    const file = Bun.file(TOKEN_FILE);
    if (!(await file.exists())) return {};
    const raw = await file.text();
    const [store, parseErr] = safeJsonParse(raw, cachedTokensSchema);
    if (parseErr) {
        debug('Failed to parse token cache:', parseErr.message);
        return {};
    }
    return store;
}

export async function loadCachedTokens(host: string): AsyncResult<OAuthTokens> {
    const store = await readStore();
    const key = hostKey(host);
    const entry = store[key];
    if (!entry) {
        return err(new Error('No cached tokens found'));
    }
    debug('Loaded cached tokens for', key);
    return ok(entry);
}

export async function saveCachedTokens(host: string, tokens: OAuthTokens): Promise<void> {
    const store = await readStore();
    const key = hostKey(host);
    store[key] = tokens;
    await Bun.write(TOKEN_FILE, JSON.stringify(store, null, 2));
    debug('Saved tokens to cache for', key);
}
