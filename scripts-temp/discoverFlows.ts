import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import type { CsnFile } from '../src/types/csn';

export interface DiscoveredFlow {
    file: string;
    flowName: string;
    csn: CsnFile;
}

const CSN_DIR = 'C:/Artisan/Transfer-Repos/Madiba-Demo-Transfer/bdc/csn/replication_flows';

export function discoverFlows(): DiscoveredFlow[] {
    const files = readdirSync(CSN_DIR).filter(f => f.endsWith('.json'));
    if (files.length === 0) {
        console.error('No CSN files found in', CSN_DIR);
        process.exit(1);
    }

    console.log(`Found ${files.length} CSN file(s) in ${CSN_DIR}\n`);

    const flows: DiscoveredFlow[] = [];

    for (const file of files) {
        const raw = readFileSync(join(CSN_DIR, file), 'utf-8');
        const csn: CsnFile = JSON.parse(raw);

        if (!csn.replicationflows) {
            console.warn(`[SKIP] ${file} — no replicationflows key`);
            continue;
        }

        const flowNames = Object.keys(csn.replicationflows);
        if (flowNames.length === 0) {
            console.warn(`[SKIP] ${file} — replicationflows is empty`);
            continue;
        }

        for (const flowName of flowNames) {
            flows.push({ file, flowName, csn });
        }
    }

    if (flows.length === 0) {
        console.error('No replication flows found across all CSN files.');
        process.exit(1);
    }

    console.log(`Discovered ${flows.length} replication flow(s):\n`);
    for (const { file, flowName } of flows) {
        console.log(`  ${flowName}  (${file})`);
    }
    console.log();

    return flows;
}
