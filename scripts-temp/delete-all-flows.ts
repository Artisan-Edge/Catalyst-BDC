import 'dotenv/config';

import { createClient } from '../src/client';
import type { BdcConfig } from '../src/types/config';
import { DESIGN_OBJECT_KINDS } from '../src/types/designObject';

const CONCURRENCY = 20;
const DRY_RUN = process.argv.includes('--dry-run');

const config: BdcConfig = {
    host: process.env['DSP_HOST']!,
    space: process.env['DSP_SPACE']!,
    verbose: false,
    oauth: { optionsFile: './oauth.json' },
};

async function main(): Promise<void> {
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

    const [objects, listErr] = await client.listObjects({
        kind: DESIGN_OBJECT_KINDS.replicationFlow,
        excludeFolders: true,
    });
    if (listErr) {
        console.error('Failed to list replication flows:', listErr.message);
        process.exit(1);
    }

    if (objects.length === 0) {
        console.log(`No replication flows found in space ${config.space}`);
        return;
    }

    console.log(`Found ${objects.length} replication flow(s) in space ${config.space}:\n`);
    for (const obj of objects) {
        const status = obj.deployment_status_description ?? '';
        console.log(`  ${obj.name}${status ? `  [${status}]` : ''}`);
    }
    console.log();

    if (DRY_RUN) {
        console.log('--dry-run set; no deletions performed.');
        return;
    }

    // Fisher-Yates shuffle so retries spread load instead of hammering the same prefix.
    for (let i = objects.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [objects[i], objects[j]] = [objects[j]!, objects[i]!];
    }

    let succeeded = 0;
    let failed = 0;
    let cursor = 0;

    async function worker(): Promise<void> {
        while (cursor < objects.length) {
            const obj = objects[cursor++]!;
            console.log(`[DELETE] ${obj.name}`);

            const [, delErr] = await client.deleteReplicationFlow(obj.name);
            if (delErr) {
                console.error(`  [FAIL] ${obj.name}: ${delErr.message}`);
                failed++;
                continue;
            }

            console.log(`  [OK] ${obj.name}`);
            succeeded++;
        }
    }

    const workerCount = Math.min(CONCURRENCY, objects.length);
    await Promise.all(Array.from({ length: workerCount }, () => worker()));

    console.log('\n--- Summary ---');
    console.log(`Total:     ${objects.length}`);
    console.log(`Succeeded: ${succeeded}`);
    console.log(`Failed:    ${failed}`);

    if (failed > 0) process.exit(1);
}

main();
