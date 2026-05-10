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

    // Extract only replication flows from the table CSN files
    const merged: CsnFile = { replicationflows: {} };

    for (const { csn } of tables) {
        if (!csn.replicationflows) continue;
        if (!merged.version && csn.version) merged.version = csn.version;
        if (!merged.meta && csn.meta) merged.meta = csn.meta;
        if (!merged.$version && csn.$version) merged.$version = csn.$version;

        for (const [name, flow] of Object.entries(csn.replicationflows)) {
            merged.replicationflows![name] = flow;
        }
    }

    const flowCount = Object.keys(merged.replicationflows ?? {}).length;
    if (flowCount === 0) {
        console.error('No replication flows found in any table CSN file.');
        process.exit(1);
    }

    console.log(`Extracted ${flowCount} replication flow(s) from ${tables.length} table files\n`);

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

    console.log(`Imported and deployed ${result.objectIds.length} flow(s).`);
}

main();
