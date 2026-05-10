import 'dotenv/config';

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createClient } from '../src/client';
import type { BdcConfig } from '../src/types/config';
import type { CsnFile } from '../src/types/csn';

const VIEWS_DIR = 'C:/Artisan/Transfer-Repos/Madiba-Demo-Transfer/bdc/csn/views';

const config: BdcConfig = {
    host: process.env['DSP_HOST']!,
    space: process.env['DSP_SPACE']!,
    verbose: true,
    oauth: { optionsFile: './oauth.json' },
};

async function main(): Promise<void> {
    // Read and alphabetize view files
    const files = readdirSync(VIEWS_DIR)
        .filter(f => f.endsWith('.json'))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    console.log(`Found ${files.length} view files (alphabetized):\n`);
    for (const file of files) {
        console.log(`  ${file}`);
    }
    console.log();

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

    // Import each file one at a time
    for (const [i, file] of files.entries()) {
        const label = `[${i + 1}/${files.length}] ${file}`;
        console.log(`\nImporting ${label}...`);

        const raw = readFileSync(join(VIEWS_DIR, file), 'utf-8');
        const csn: CsnFile = JSON.parse(raw);

        const defCount = Object.keys(csn.definitions ?? {}).length;
        console.log(`  ${defCount} definition(s)`);

        const [result, importErr] = await client.importCsn(csn);
        if (importErr) {
            console.error(`  FAILED: ${importErr.message}`);
            continue;
        }

        console.log(`  Imported ${result.objectIds.length} object(s)`);
    }

    console.log('\nDone.');
}

main();
