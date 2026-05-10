import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import type { CsnFile } from '../src/types/csn';

export interface DiscoveredTable {
    file: string;
    tableName: string;
    csn: CsnFile;
}

const CSN_DIR = 'C:/Artisan/Transfer-Repos/Madiba-Demo-Transfer/bdc/csn/local_tables';

export function discoverTables(): DiscoveredTable[] {
    const files = readdirSync(CSN_DIR).filter(f => f.endsWith('.json'));
    if (files.length === 0) {
        console.error('No CSN files found in', CSN_DIR);
        process.exit(1);
    }

    console.log(`Found ${files.length} CSN file(s) in ${CSN_DIR}\n`);

    const tables: DiscoveredTable[] = [];

    for (const file of files) {
        const raw = readFileSync(join(CSN_DIR, file), 'utf-8');
        const csn: CsnFile = JSON.parse(raw);

        if (!csn.definitions) {
            console.warn(`[SKIP] ${file} — no definitions key`);
            continue;
        }

        const tableNames = Object.keys(csn.definitions);
        if (tableNames.length === 0) {
            console.warn(`[SKIP] ${file} — definitions is empty`);
            continue;
        }

        for (const tableName of tableNames) {
            tables.push({ file, tableName, csn });
        }
    }

    if (tables.length === 0) {
        console.error('No local tables found across all CSN files.');
        process.exit(1);
    }

    console.log(`Discovered ${tables.length} local table(s):\n`);
    for (const { file, tableName } of tables) {
        console.log(`  ${tableName}  (${file})`);
    }
    console.log();

    return tables;
}
