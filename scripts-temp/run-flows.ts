import 'dotenv/config';

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { createClient } from '../src/client';
import type { BdcConfig } from '../src/types/config';
import type { CsnFile } from '../src/types/csn';

const CONCURRENCY = 10;
const CSN_DIR = 'C:/Artisan/Transfer-Repos/Madiba-Demo-Transfer/bdc/csn/local_tables';

const config: BdcConfig = {
    host: process.env['DSP_HOST']!,
    space: process.env['DSP_SPACE']!,
    verbose: true,
    oauth: { optionsFile: './oauth.json' },
};

async function main(): Promise<void> {
    const files = readdirSync(CSN_DIR).filter(f => f.endsWith('.json'));
    if (files.length === 0) {
        console.error('No CSN files found in', CSN_DIR);
        process.exit(1);
    }

    // Extract flow names from CSN files
    const flows: { file: string; flowName: string }[] = [];
    for (const file of files) {
        const raw = readFileSync(join(CSN_DIR, file), 'utf-8');
        const csn: CsnFile = JSON.parse(raw);
        if (!csn.replicationflows) continue;

        for (const flowName of Object.keys(csn.replicationflows)) {
            flows.push({ file, flowName });
        }
    }

    if (flows.length === 0) {
        console.error('No replication flows found in any CSN file.');
        process.exit(1);
    }

    console.log(`Discovered ${flows.length} replication flow(s):\n`);
    for (const { file, flowName } of flows) {
        console.log(`  ${flowName}  (${file})`);
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

    // Run in batches of CONCURRENCY
    let succeeded = 0;
    let failed = 0;

    for (let i = 0; i < flows.length; i += CONCURRENCY) {
        const batch = flows.slice(i, i + CONCURRENCY);

        const results = await Promise.allSettled(
            batch.map(async ({ file, flowName }) => {
                console.log(`[RUN] ${flowName}  (${file})`);

                const [result, runErr] = await client.runReplicationFlow(flowName);
                if (runErr) {
                    console.error(`  [FAIL] ${flowName}: ${runErr.message}`);
                    throw runErr;
                }

                console.log(`  [OK] ${flowName}: status=${result.status} runStatus=${result.runStatus}`);
                return result;
            }),
        );

        for (const r of results) {
            if (r.status === 'fulfilled') succeeded++;
            else failed++;
        }
    }

    // Summary
    console.log('\n--- Summary ---');
    console.log(`Total:     ${flows.length}`);
    console.log(`Succeeded: ${succeeded}`);
    console.log(`Failed:    ${failed}`);

    if (failed > 0) process.exit(1);
}

main();
