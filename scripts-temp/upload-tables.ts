import 'dotenv/config';

import { createClient } from '../src/client';
import type { BdcConfig } from '../src/types/config';
import type { CsnFile } from '../src/types/csn';
import { discoverTables } from './discoverTables';

const config: BdcConfig = {
    host: process.env['DSP_HOST']!,
    space: process.env['DSP_SPACE']!,
    verbose: true,
    oauth: { optionsFile: './oauth.json' },
};

async function main(): Promise<void> {
    const tables = discoverTables();

    // Merge all CSNs (tables + bundled replication flows) into one
    const merged: CsnFile = { definitions: {} };

    for (const { csn } of tables) {
        if (!merged.version && csn.version) merged.version = csn.version;
        if (!merged.meta && csn.meta) merged.meta = csn.meta;
        if (!merged.$version && csn.$version) merged.$version = csn.$version;

        if (csn.definitions) {
            Object.assign(merged.definitions!, csn.definitions);
        }

        if (csn.replicationflows) {
            if (!merged.replicationflows) merged.replicationflows = {};
            for (const [name, flow] of Object.entries(csn.replicationflows)) {
                merged.replicationflows[name] = flow;
            }
        }
    }

    const defCount = Object.keys(merged.definitions ?? {}).length;
    const flowCount = Object.keys(merged.replicationflows ?? {}).length;
    console.log(`Merged ${tables.length} files → ${defCount} definitions, ${flowCount} flows\n`);

    const [client, clientErr] = createClient(config);
    if (clientErr) {
        console.error('Failed to create client:', clientErr.message);
        process.exit(1);
    }

    const [, loginErr] = await client.login();
    if (loginErr) {
        console.error('Login failed:', loginErr.message);
        process.exit(1);
    }

    const [result, importErr] = await client.importCsn(merged);
    if (importErr) {
        console.error('Import failed:', importErr.message);
        process.exit(1);
    }

    console.log(`Imported and deployed ${result.objectIds.length} objects.`);
}

main();
