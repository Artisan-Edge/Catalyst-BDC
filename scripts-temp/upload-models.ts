import 'dotenv/config';

import { createClient } from '../src/client';
import type { BdcConfig } from '../src/types/config';
import type { CsnFile } from '../src/types/csn';
import { discoverModels } from './discoverModels';

const config: BdcConfig = {
    host: process.env['DSP_HOST']!,
    space: process.env['DSP_SPACE']!,
    verbose: true,
    oauth: { optionsFile: './oauth.json' },
};

async function main(): Promise<void> {
    const models = discoverModels();

    // Merge all model CSNs into a single multi-definition CSN
    const merged: CsnFile = { definitions: {} };
    for (const { csn } of models) {
        if (!merged.version && csn.version) merged.version = csn.version;
        if (!merged.meta && csn.meta) merged.meta = csn.meta;
        if (!merged.$version && csn.$version) merged.$version = csn.$version;

        if (csn.definitions) {
            Object.assign(merged.definitions!, csn.definitions);
        }

        if (csn.businessLayerDefinitions) {
            if (!merged.businessLayerDefinitions) merged.businessLayerDefinitions = {};
            Object.assign(merged.businessLayerDefinitions, csn.businessLayerDefinitions);
        }

        if (csn.replicationflows) {
            if (!merged.replicationflows) merged.replicationflows = {};
            Object.assign(merged.replicationflows, csn.replicationflows);
        }
    }

    const defCount = Object.keys(merged.definitions ?? {}).length;
    const bldCount = Object.keys(merged.businessLayerDefinitions ?? {}).length;
    const flowCount = Object.keys(merged.replicationflows ?? {}).length;
    console.log(`Merged ${models.length} files → ${defCount} definitions, ${bldCount} businessLayerDefinitions, ${flowCount} replicationflows\n`);

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

    console.log(`Imported and deployed ${result.objectIds.length} analytic models.`);
}

main();
