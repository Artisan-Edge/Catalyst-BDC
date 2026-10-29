import path from 'node:path';
import os from 'node:os';
import { mkdir, rename, unlink } from 'node:fs/promises';
import { z } from 'zod';
import type { OAuthTokens } from './oauth';
import type { AsyncResult } from '../../types/result';
import { ok, err } from '../../types/result';
import { safeJsonParse } from '../utils/json';
import { debug } from '../utils/logging';

const TOKEN_FILE = path.join(os.homedir(), '.catalyst-bdc', 'tokens.json');

// Windows refuses to replace a file another process has open for reading; those clear quickly
const TRANSIENT_RENAME_CODES = new Set(['EPERM', 'EBUSY', 'EACCES']);
const RENAME_ATTEMPTS = 6;
const RENAME_BACKOFF_MS = 25;

const cachedTokensSchema = z.record(z.string(), z.object({
    accessToken: z.string(),
    refreshToken: z.string(),
    expiresAfter: z.number(),
    tokenUrl: z.string(),
    clientId: z.string(),
    clientSecret: z.string(),
}));

type TokenStore = z.infer<typeof cachedTokensSchema>;

// Read-modify-write cycles queue behind each other so two saves in one process can't drop each other's entry
let storeQueue: Promise<unknown> = Promise.resolve();
let tempCounter = 0;

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

function isTransientRenameError(error: unknown): boolean {
    const code = (error as NodeJS.ErrnoException).code;
    return code !== undefined && TRANSIENT_RENAME_CODES.has(code);
}

// Write a sibling temp file and rename it over the store, so a concurrent reader (this process or
// another catalyst process) sees either the old file or the new one, never a half-written one
async function writeStore(store: TokenStore): Promise<void> {
    await mkdir(path.dirname(TOKEN_FILE), { recursive: true });
    const tempFile = `${TOKEN_FILE}.${process.pid}.${++tempCounter}.tmp`;
    await Bun.write(tempFile, JSON.stringify(store, null, 2));

    for (let attempt = 1; ; attempt++) {
        try {
            await rename(tempFile, TOKEN_FILE);
            return;
        } catch (error) {
            if (attempt >= RENAME_ATTEMPTS || !isTransientRenameError(error)) {
                await unlink(tempFile).catch(() => undefined);
                throw error;
            }
            await Bun.sleep(RENAME_BACKOFF_MS * attempt);
        }
    }
}

// Derive the next store from the freshly read one and persist it; `next` returns null for "no change"
function updateStore(next: (store: TokenStore) => TokenStore | null): Promise<boolean> {
    const run = storeQueue.then(async () => {
        const updated = next(await readStore());
        if (!updated) return false;
        await writeStore(updated);
        return true;
    });
    storeQueue = run.catch(() => undefined);
    return run;
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
    const key = hostKey(host);
    await updateStore(store => ({ ...store, [key]: tokens }));
    debug('Saved tokens to cache for', key);
}

export async function deleteCachedTokens(host: string): Promise<boolean> {
    const key = hostKey(host);
    const deleted = await updateStore(store => {
        if (!(key in store)) return null;
        return Object.fromEntries(Object.entries(store).filter(([host]) => host !== key));
    });
    if (deleted) debug('Deleted cached tokens for', key);
    return deleted;
}
