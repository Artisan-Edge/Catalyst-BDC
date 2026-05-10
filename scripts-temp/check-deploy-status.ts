import 'dotenv/config';

import { createClient } from '../src/client';
import type { BdcConfig } from '../src/types/config';

const OBJECT_NAME = 'ZSNAP_F01S_Q01';
const EXPECTED_OBJECT_ID = 'F37423D95C4E7AC11900094EDA770226';
const SPACE = 'ARTISANHANA';

const config: BdcConfig = {
    host: process.env['DSP_HOST']!,
    space: SPACE,
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

    console.log(`Checking deployment status for ${OBJECT_NAME}...\n`);

    // Search for the object by name
    const [searchResult, searchErr] = await client.searchObjects({
        query: OBJECT_NAME,
        top: 10,
    });

    if (searchErr) {
        console.error('Search failed:', searchErr.message);
        process.exit(1);
    }

    if (searchResult.objects.length === 0) {
        console.error(`Object ${OBJECT_NAME} not found in space ${SPACE}.`);
        process.exit(1);
    }

    // Find the exact match (search can return partial matches)
    const match = searchResult.objects.find(
        o => o.name === OBJECT_NAME || o.id === EXPECTED_OBJECT_ID,
    );

    if (!match) {
        console.error(`No exact match for ${OBJECT_NAME}. Found:`);
        for (const obj of searchResult.objects) {
            console.error(`  - ${obj.name} (${obj.id})`);
        }
        process.exit(1);
    }

    // Report status
    console.log('Object found:');
    console.log(`  Name:              ${match.name}`);
    console.log(`  ID:                ${match.id}`);
    console.log(`  Kind:              ${match.kind}`);
    console.log(`  Technical type:    ${match.technical_type ?? 'n/a'}`);
    console.log(`  Business name:     ${match.business_name ?? 'n/a'}`);
    console.log(`  Deployment status: ${match.deployment_status ?? 'UNKNOWN'}`);
    console.log(`  Status detail:     ${match.deployment_status_description ?? 'n/a'}`);
    console.log(`  Object status:     ${match.object_status ?? 'n/a'}`);
    console.log(`  Object status desc:${match.object_status_description ?? 'n/a'}`);
    console.log(`  Last modified:     ${match.modification_date ?? 'n/a'}`);
    console.log(`  Changed by:        ${match.changed_by_user_name ?? 'n/a'}`);

    // Interpret deployment status
    const status = match.deployment_status;
    console.log('');

    if (status === 'ACTIVE') {
        console.log('RESULT: Deployment SUCCEEDED. Object is active on HANA.');
    } else if (status === 'DESIGN_TIME_ONLY') {
        console.log('RESULT: Deployment FAILED or was never deployed. Object exists only at design time.');
    } else if (status === 'DEPLOYING') {
        console.log('RESULT: Deployment is still IN PROGRESS.');
    } else if (status === 'ERROR' || status === 'FAILED') {
        console.log(`RESULT: Deployment FAILED with status: ${status}`);
    } else {
        console.log(`RESULT: Unexpected deployment status: ${status ?? 'null'}`);
    }
}

main();
