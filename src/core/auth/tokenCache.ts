import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { z } from 'zod';
import type { OAuthTokens } from './oauth';
import type { Result } from '../../types/result';
import { ok, err } from '../../types/result';
import { safeJsonParse } from '../utils/json';
import { debug } from '../utils/logging';

const TOKEN_DIR = path.join(os.homedir(), '.catalyst-bdc');
const TOKEN_FILE = path.join(TOKEN_DIR, 'tokens.json');

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

function readStore(): TokenStore {
    if (!fs.existsSync(TOKEN_FILE)) return {};
    const raw = fs.readFileSync(TOKEN_FILE, 'utf-8');
    const [store, parseErr] = safeJsonParse(raw, cachedTokensSchema);
    if (parseErr) {
        debug('Failed to parse token cache:', parseErr.message);
        return {};
    }
    return store;
}

function writeStore(store: TokenStore): void {
    if (!fs.existsSync(TOKEN_DIR)) {
        fs.mkdirSync(TOKEN_DIR, { recursive: true });
    }
    fs.writeFileSync(TOKEN_FILE, JSON.stringify(store, null, 2));
}

export function loadCachedTokens(host: string): Result<OAuthTokens> {
    const store = readStore();
    const key = hostKey(host);
    const entry = store[key];
    if (!entry) {
        return err(new Error('No cached tokens found'));
    }
    debug('Loaded cached tokens for', key);
    return ok(entry);
}

export function saveCachedTokens(host: string, tokens: OAuthTokens): void {
    const store = readStore();
    const key = hostKey(host);
    store[key] = tokens;
    writeStore(store);
    debug('Saved tokens to cache for', key);
}
