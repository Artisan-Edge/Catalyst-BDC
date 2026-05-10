import 'dotenv/config';
import { createClient } from '../src';
import type { BdcConfig } from '../src';

const config: BdcConfig = {
    host: process.env['DSP_HOST']!,
    space: process.env['DSP_SPACE']!,
    verbose: false,
    oauth: { optionsFile: './oauth.json' },
};

const VIEW_NAMES = [
    'ZSNAP_F01G_GLACCOUNTHIERARCHY',
    'ZSNAP_F01G_COSTCENTER',
    'ZSNAP_F01G_PROFITCENTER',
] as const;

const TARGET_FIELD = 'VALIDITYSTARTDATE';

async function main(): Promise<void> {
    const [client, clientErr] = createClient(config);
    if (clientErr) { console.error('Failed to create client:', clientErr.message); process.exit(1); }

    console.log('Logging in...');
    const [, loginErr] = await client.login();
    if (loginErr) { console.error('Login failed:', loginErr.message); process.exit(1); }
    console.log('Login successful.\n');

    for (const viewName of VIEW_NAMES) {
        console.log('='.repeat(60));
        console.log(`View: ${viewName}`);
        console.log('='.repeat(60));

        const [body, readErr] = await client.readView(viewName);
        if (readErr) {
            console.error(`  ERROR reading view: ${readErr.message}\n`);
            continue;
        }

        // Parse the response to inspect definitions
        let parsed: unknown;
        try {
            parsed = JSON.parse(body);
        } catch {
            console.error('  ERROR: response is not valid JSON\n');
            continue;
        }

        const defs = (parsed as Record<string, unknown>)['definitions'] as Record<string, unknown> | undefined;
        if (!defs) {
            console.log('  No "definitions" key in response.\n');
            continue;
        }

        for (const [defName, defValue] of Object.entries(defs)) {
            const def = defValue as Record<string, unknown>;
            const elements = def['elements'] as Record<string, unknown> | undefined;
            if (!elements) {
                console.log(`  ${defName}: no "elements" key`);
                continue;
            }

            const field = elements[TARGET_FIELD] as Record<string, unknown> | undefined;
            if (!field) {
                console.log(`  ${defName}: ${TARGET_FIELD} NOT FOUND`);
                console.log(`    Available fields: ${Object.keys(elements).join(', ')}`);
            } else {
                console.log(`  ${defName}: ${TARGET_FIELD} EXISTS`);
                console.log(`    Full field definition: ${JSON.stringify(field, null, 4)}`);
            }
        }

        console.log();
    }
}

main();
