import 'dotenv/config';
import { createClient } from '../../client';
import type { BdcClient } from '../../client';
import type { BdcConfig } from '../../types/config';
import type { DatasphereObjectTypeName } from '../../types/objectTypes';

const HOST = process.env['DSP_HOST'] ?? '';
const SPACE = process.env['DSP_SPACE'] ?? '';

function validateEnv(): void {
    if (!HOST) throw new Error('DSP_HOST environment variable is required');
    if (!SPACE) throw new Error('DSP_SPACE environment variable is required');
}

export function createTestConfig(): BdcConfig {
    validateEnv();
    return {
        host: HOST,
        space: SPACE,
        verbose: true,
        oauth: { optionsFile: './oauth.json' },
    };
}

export function createTestClient(): BdcClient {
    const config = createTestConfig();
    const [client, clientErr] = createClient(config);
    if (clientErr) throw new Error(`Failed to create client: ${clientErr.message}`);
    return client;
}

export async function safeDelete(
    client: BdcClient,
    type: DatasphereObjectTypeName,
    name: string,
): Promise<void> {
    switch (type) {
        case 'view': {
            const [, deleteErr] = await client.deleteView(name);
            if (deleteErr) console.warn(`Cleanup: failed to delete view "${name}":`, deleteErr.message);
            break;
        }
        case 'local-table': {
            const [, deleteErr] = await client.deleteLocalTable(name);
            if (deleteErr) console.warn(`Cleanup: failed to delete local table "${name}":`, deleteErr.message);
            break;
        }
        case 'replication-flow': {
            const [, deleteErr] = await client.deleteReplicationFlow(name);
            if (deleteErr) console.warn(`Cleanup: failed to delete replication flow "${name}":`, deleteErr.message);
            break;
        }
    }
}
