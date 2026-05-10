import 'dotenv/config';

import { readFileSync } from 'node:fs';
import { createClient } from '../src/client';
import type { BdcConfig } from '../src/types/config';
import type { CsnFile } from '../src/types/csn';

const CSN_PATH = 'C:/Artisan/Transfer-Repos/Madiba-Demo-Transfer/bdc/csn/analytical_models/ZSNAP_F01S_Q01.json';

const config: BdcConfig = {
    host: process.env['DSP_HOST']!,
    space: process.env['DSP_SPACE']!,
    verbose: true,
    oauth: { optionsFile: './oauth.json' },
};

async function main(): Promise<void> {
    const csn: CsnFile = JSON.parse(readFileSync(CSN_PATH, 'utf-8'));
    console.log('Loaded CSN with definitions:', Object.keys(csn.definitions ?? {}));
    console.log('BLD keys:', Object.keys(csn.businessLayerDefinitions ?? {}));

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

    console.log('\nImporting ZSNAP_F01S_Q01...');
    const [result, importErr] = await client.importCsn(csn);
    if (importErr) {
        console.error('Import failed:', importErr.message);
        process.exit(1);
    }

    console.log(`Success! Imported ${result.objectIds.length} object(s):`, result.objectIds);
}

main();
