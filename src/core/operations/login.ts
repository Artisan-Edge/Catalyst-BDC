import fs from 'fs';
import os from 'os';
import path from 'path';
import type { BdcConfig, OAuthConfig } from '../../types/config';
import type { AsyncResult } from '../../types/result';
import { ok, err } from '../../types/result';
import { spawnAsync } from '../cli/executor';
import { debug } from '../utils/logging';

function isInlineOAuth(oauth: OAuthConfig | { optionsFile: string }): oauth is OAuthConfig {
    return 'clientId' in oauth;
}

// Returns [filePath, needsCleanup]
function resolveOptionsFile(oauth: OAuthConfig | { optionsFile: string }): [string, boolean] {
    if (!isInlineOAuth(oauth)) {
        return [path.resolve(oauth.optionsFile), false];
    }

    const tmpFile = path.join(os.tmpdir(), 'datasphere-oauth-options.json');
    fs.writeFileSync(tmpFile, JSON.stringify({
        'client-id': oauth.clientId,
        'client-secret': oauth.clientSecret,
        'authorization-url': oauth.authorizationUrl,
        'token-url': oauth.tokenUrl,
    }, null, 2));
    return [tmpFile, true];
}

// Runs a callback, then cleans up the temp file if needed
async function withOptionsFile<T>(
    oauth: OAuthConfig | { optionsFile: string },
    fn: (optionsFile: string) => Promise<T>,
): Promise<T> {
    const [optionsFile, needsCleanup] = resolveOptionsFile(oauth);
    try {
        return await fn(optionsFile);
    } finally {
        if (needsCleanup && fs.existsSync(optionsFile)) {
            fs.unlinkSync(optionsFile);
        }
    }
}

async function isAlreadyAuthenticated(host: string): Promise<boolean> {
    const result = await spawnAsync('npx', [
        'datasphere', 'config', 'cache', 'list',
        '--host', host,
    ]);
    return result.code === 0;
}

export async function login(config: BdcConfig): AsyncResult<void> {
    if (await isAlreadyAuthenticated(config.host)) {
        debug('Already authenticated, skipping login');
        return ok(undefined);
    }

    if (!config.oauth) {
        return err(new Error('OAuth configuration required — provide oauth credentials in BdcConfig'));
    }

    if (!isInlineOAuth(config.oauth)) {
        const resolved = path.resolve(config.oauth.optionsFile);
        if (!fs.existsSync(resolved)) {
            return err(new Error(`OAuth options file not found: ${resolved}`));
        }
    }

    return withOptionsFile(config.oauth, async (optionsFile) => {
        // Step 1: Login (opens browser, waits for OAuth callback)
        debug('Starting OAuth login...');
        const loginResult = await spawnAsync('npx', [
            'datasphere', 'login',
            '--host', config.host,
            '--options-file', optionsFile,
        ]);

        if (loginResult.code !== 0) {
            return err(new Error(`Login failed (exit ${loginResult.code}): ${loginResult.stderr || loginResult.stdout}`));
        }
        debug('Login successful');

        // Step 2: Initialize discovery cache
        debug('Initializing CLI discovery cache...');
        const cacheResult = await spawnAsync('npx', [
            'datasphere', 'config', 'cache', 'init',
            '--host', config.host,
        ]);

        if (cacheResult.code !== 0) {
            return err(new Error(`Cache init failed (exit ${cacheResult.code}): ${cacheResult.stderr || cacheResult.stdout}`));
        }
        debug('Cache initialized');

        return ok(undefined);
    });
}
