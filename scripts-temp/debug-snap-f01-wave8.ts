import 'dotenv/config';

import { readFileSync } from 'node:fs';
import { createClient } from '../src/client';
import type { BdcConfig } from '../src/types/config';
import type { CsnFile } from '../src/types/csn';

const FILE = 'C:/Artisan/Transfer-Repos/Madiba-Demo-Transfer/bdc/csn/views/SNAP F01 - Wave 8.json';

const config: BdcConfig = {
    host: process.env['DSP_HOST']!,
    space: process.env['DSP_SPACE']!,
    verbose: false,
    oauth: { optionsFile: './oauth.json' },
};

interface DefResult {
    name: string;
    ok: boolean;
    error?: string;
}

async function main(): Promise<void> {
    const raw = readFileSync(FILE, 'utf-8');
    const full: CsnFile = JSON.parse(raw);

    const defs = full.definitions ?? {};
    const names = Object.keys(defs);
    console.log(`Loaded ${names.length} definitions from ${FILE}\n`);

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

    const results: DefResult[] = [];

    for (const [i, name] of names.entries()) {
        const label = `[${i + 1}/${names.length}] ${name}`;
        console.log(`\nImporting ${label}...`);

        const single: CsnFile = {
            ...full,
            definitions: { [name]: defs[name]! },
        };

        const [result, importErr] = await client.importCsn(single);
        if (importErr) {
            console.error(`  FAILED: ${importErr.message}`);
            results.push({ name, ok: false, error: importErr.message });
            continue;
        }

        console.log(`  Imported ${result.objectIds.length} object(s)`);
        results.push({ name, ok: true });
    }

    console.log('\n\n=== SUMMARY ===');
    for (const r of results) {
        const status = r.ok ? 'OK    ' : 'FAILED';
        console.log(`  ${status}  ${r.name}${r.error ? `  — ${r.error}` : ''}`);
    }

    const failed = results.filter(r => !r.ok);
    console.log(`\n${results.length - failed.length}/${results.length} succeeded, ${failed.length} failed.`);
}

main();
