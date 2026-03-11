import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { createClient, checkResponse } from '../src';
import type { BdcConfig, CsnFile, DatasphereRequestor } from '../src';

const VIEWS_DIR = path.join(String.raw`C:\Artisan\Transfer-Repos\Madiba-Demo-Transfer\bdc\csn`, 'views');
const IMPORT_ORDER_PATH = path.join(VIEWS_DIR, 'import_order.json');
const TEMP_DIR = path.join(import.meta.dirname, '..', 'temp');

const config: BdcConfig = {
    host: process.env['DSP_HOST']!,
    space: process.env['DSP_SPACE']!,
    verbose: true,
    oauth: { optionsFile: './oauth.json' },
};

interface WaveResult {
    wave: number;
    definitions: number;
    files: number;
    status: 'ok' | 'error';
    message: string;
}

function buildWaveCsn(filePaths: string[]): CsnFile {
    const merged: CsnFile = { definitions: {} };

    for (const filePath of filePaths) {
        const raw = fs.readFileSync(filePath, 'utf-8');
        const csn = JSON.parse(raw) as CsnFile;
        if (!csn.definitions) continue;

        // Grab version/meta from first file that has them
        if (!merged.version && csn.version) merged.version = csn.version;
        if (!merged.meta && csn.meta) merged.meta = csn.meta;
        if (!merged.$version && csn.$version) merged.$version = csn.$version;

        Object.assign(merged.definitions!, csn.definitions);
    }

    return merged;
}

async function uploadWaveCsn(
    requestor: DatasphereRequestor,
    space: string,
    csn: CsnFile,
    waveIndex: number,
    fileCount: number,
): Promise<WaveResult> {
    const definitionCount = Object.keys(csn.definitions ?? {}).length;
    const waveNum = waveIndex + 1;

    console.log(`[UPLOAD] Wave ${waveNum} — ${definitionCount} definitions from ${fileCount} files`);

    const [response, reqErr] = await requestor.request({
        method: 'POST',
        path: `/dwaas-core/api/v1/spaces/${space}/views`,
        params: { saveAnyway: 'true', allowMissingDependencies: 'true', deploy: 'true' },
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(csn),
    });

    const [body, checkErr] = await checkResponse(response, reqErr, `Wave ${waveNum} batch upload`);
    if (checkErr) {
        console.error(`  ERROR: ${checkErr.message}\n`);
        return { wave: waveNum, definitions: definitionCount, files: fileCount, status: 'error', message: checkErr.message };
    }

    console.log(`  OK: ${body.substring(0, 200)}\n`);
    return { wave: waveNum, definitions: definitionCount, files: fileCount, status: 'ok', message: body.substring(0, 200) };
}

function parseFirstWave(totalWaves: number): number {
    const { values } = parseArgs({
        options: { 'first-wave': { type: 'string' } },
        strict: false,
    });

    const raw = values['first-wave'];
    if (!raw) return 0;

    const n = Number(raw);
    if (!Number.isInteger(n) || n < 1 || n > totalWaves) {
        console.error(`--first-wave must be between 1 and ${totalWaves}, got "${raw}"`);
        process.exit(1);
    }

    return n - 1;
}

async function main() {
    const [client, clientErr] = createClient(config);
    if (clientErr) { console.error('Failed to create client:', clientErr.message); process.exit(1); }

    console.log('Logging in...');
    const [, loginErr] = await client.login();
    if (loginErr) { console.error('Login failed:', loginErr.message); process.exit(1); }
    console.log('Login successful.\n');

    // Access internal requestor for raw HTTP calls (bypassing single-object extraction)
    const requestor = (client as unknown as { requestor: DatasphereRequestor }).requestor;

    const importOrder: { import_order: string[][] } = JSON.parse(
        fs.readFileSync(IMPORT_ORDER_PATH, 'utf-8'),
    );
    const waves = importOrder.import_order;
    const firstWave = parseFirstWave(waves.length);
    const remainingWaves = waves.slice(firstWave);
    const totalFiles = remainingWaves.reduce((sum, wave) => sum + wave.length, 0);

    fs.mkdirSync(TEMP_DIR, { recursive: true });

    if (firstWave > 0) {
        console.log(`Skipping to wave ${firstWave + 1} (--first-wave)`);
    }
    console.log(`Found ${totalFiles} view files across ${remainingWaves.length} waves.`);
    console.log(`Will make ${remainingWaves.length} API calls (one per wave).\n`);

    // Build and write all wave CSNs to temp first
    const waveCsns: { csn: CsnFile; fileCount: number }[] = [];

    for (let w = firstWave; w < waves.length; w++) {
        const wave = waves[w]!;
        const waveCsn = buildWaveCsn(wave);
        const definitionCount = Object.keys(waveCsn.definitions ?? {}).length;

        const tempFile = path.join(TEMP_DIR, `wave_${String(w + 1).padStart(2, '0')}.json`);
        fs.writeFileSync(tempFile, JSON.stringify(waveCsn, null, 2));
        console.log(`Wave ${w + 1}: ${wave.length} files → ${definitionCount} definitions → ${tempFile}`);

        waveCsns.push({ csn: waveCsn, fileCount: wave.length });
    }

    console.log(`\nWrote ${waveCsns.length} merged CSN files to ${TEMP_DIR}\n`);

    // Upload each wave
    const results: WaveResult[] = [];

    for (let i = 0; i < waveCsns.length; i++) {
        const w = firstWave + i;
        const { csn, fileCount } = waveCsns[i]!;

        console.log('='.repeat(60));
        console.log(`Wave ${w + 1}/${waves.length}`);
        console.log('='.repeat(60));

        const result = await uploadWaveCsn(requestor, config.space, csn, w, fileCount);
        results.push(result);
    }

    const succeeded = results.filter(r => r.status === 'ok').length;
    const failed = results.filter(r => r.status === 'error').length;
    const totalDefs = results.reduce((sum, r) => sum + r.definitions, 0);

    console.log('='.repeat(60));
    console.log(`All waves done. ${succeeded}/${results.length} waves succeeded (${totalDefs} total definitions).`);

    if (failed > 0) {
        console.log('\nFailed waves:');
        for (const r of results.filter(r => r.status === 'error')) {
            console.log(`  Wave ${r.wave} (${r.definitions} defs): ${r.message}`);
        }
    }
}

main();
