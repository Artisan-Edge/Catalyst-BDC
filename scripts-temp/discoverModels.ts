import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import type { CsnFile } from '../src/types/csn';

export interface DiscoveredModel {
    file: string;
    modelName: string;
    csn: CsnFile;
}

const CSN_DIR = 'C:/Artisan/Transfer-Repos/Madiba-Demo-Transfer/bdc/csn/analytical_models';

export function discoverModels(): DiscoveredModel[] {
    const files = readdirSync(CSN_DIR).filter(f => f.endsWith('.json'));
    if (files.length === 0) {
        console.error('No CSN files found in', CSN_DIR);
        process.exit(1);
    }

    console.log(`Found ${files.length} CSN file(s) in ${CSN_DIR}\n`);

    const models: DiscoveredModel[] = [];

    for (const file of files) {
        const raw = readFileSync(join(CSN_DIR, file), 'utf-8');
        const csn: CsnFile = JSON.parse(raw);

        if (!csn.definitions) {
            console.warn(`[SKIP] ${file} — no definitions key`);
            continue;
        }

        const modelNames = Object.keys(csn.definitions);
        if (modelNames.length === 0) {
            console.warn(`[SKIP] ${file} — definitions is empty`);
            continue;
        }

        for (const modelName of modelNames) {
            models.push({ file, modelName, csn });
        }
    }

    if (models.length === 0) {
        console.error('No analytic models found across all CSN files.');
        process.exit(1);
    }

    console.log(`Discovered ${models.length} analytic model(s):\n`);
    for (const { file, modelName } of models) {
        console.log(`  ${modelName}  (${file})`);
    }
    console.log();

    return models;
}
