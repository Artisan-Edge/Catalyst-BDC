---
name: fix-view-deploy-issue
description: Fix Datasphere TABLE_FUNCTION views that fail to deploy with "Failed to deploy" errors. Use when a view deployment returns 400 with a generic failure message, especially after the view was previously deployed or changed from SQL_EDITOR to TABLE_FUNCTION.
---

# Fix TABLE_FUNCTION Deploy Failure

## When to Use

- A Datasphere view deploy returns `{"message":"Failed to deploy '<NAME>' in '<SPACE>'"}`
- The view uses `@Analytics.dbViewType: TABLE_FUNCTION`
- The view previously existed (was deleted and recreated, or changed view types)

## Root Cause

Datasphere's DELETE endpoint removes the **design-time** definition but does **not** clean up the underlying **HANA TABLE FUNCTION** artifact. Subsequent TABLE_FUNCTION deploys with the same name fail because the HANA artifact already exists. SQL_EDITOR views use regular SQL views (different HANA object type), so deploying as SQL_EDITOR first overwrites the stuck artifact.

## Fix Script

Write the following script to `scripts/fix-view-deploy.ts`, replacing `VIEW_NAME` and the CSN content with the actual values from the user. Run it with `npx tsx scripts/fix-view-deploy.ts`.

```typescript
import 'dotenv/config';
import fs from 'node:fs';
import { createClient } from '../src';
import type { BdcConfig, CsnFile } from '../src';
import { getAccessToken, fetchCsrf } from '../src/core/http/session';

const HOST = process.env['DSP_HOST']!.replace(/\/+$/, '');
const SPACE = process.env['DSP_SPACE']!;
const VIEW_NAME = 'REPLACE_WITH_VIEW_NAME';

const config: BdcConfig = {
    host: HOST,
    space: SPACE,
    verbose: true,
    oauth: { optionsFile: './oauth.json' },
};

// Read the original CSN file that fails to deploy
const originalCsn: CsnFile = JSON.parse(
    fs.readFileSync('REPLACE_WITH_PATH_TO_CSN', 'utf-8'),
) as CsnFile;

// Build a minimal SQL_EDITOR CSN from the original's key columns.
// This only needs to deploy successfully — the SQL doesn't need to be meaningful.
function buildCleanupCsn(original: CsnFile, viewName: string): CsnFile {
    const entity = original.definitions[viewName];
    if (!entity) throw new Error(`No entity "${viewName}" in CSN`);

    // Extract only key columns
    const keyElements: Record<string, unknown> = {};
    const selectColumns: string[] = [];
    for (const [name, el] of Object.entries(entity.elements ?? {})) {
        const element = el as { key?: boolean };
        if (!element.key) continue;
        keyElements[name] = el;
        selectColumns.push(`"${name}"`);
    }

    if (selectColumns.length === 0) {
        throw new Error('No key columns found — cannot build cleanup CSN');
    }

    // Find the source table from the TABLE_FUNCTION script
    const script = (entity as Record<string, unknown>)['@DataWarehouse.tableFunction.script'] as string | undefined;
    let sourceTable = 'DUAL';
    if (script) {
        // Extract first table name after FROM
        const fromMatch = script.match(/from\s+(\S+)/i);
        if (fromMatch) sourceTable = fromMatch[1]!.replace(/;$/, '');
    }

    const sql = `SELECT ${selectColumns.join(', ')} FROM "${sourceTable}"`;

    // Clone annotations from original, swapping TABLE_FUNCTION for SQL_EDITOR
    const { ['@DataWarehouse.tableFunction.script']: _, ['@Analytics.dbViewType']: __, ...rest } = entity as Record<string, unknown>;

    return {
        definitions: {
            [viewName]: {
                ...rest,
                elements: keyElements,
                '@DataWarehouse.sqlEditor.query': sql,
            },
        },
        version: { csn: '1.0' },
        meta: { creator: 'fix-view-deploy-issue' },
        $version: '1.0',
    } as CsnFile;
}

const API_HEADERS = (accessToken: string, csrf: string, cookies: string) => ({
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json',
    'X-Csrf-Token': csrf,
    'X-Requested-With': 'XMLHttpRequest',
    'Cookie': cookies,
});

async function deleteView(viewName: string, headers: Record<string, string>) {
    const url = `${HOST}/dwaas-core/api/v1/spaces/${SPACE}/views/${viewName}?deleteAnyway=true`;
    const res = await fetch(url, { method: 'DELETE', headers });
    const body = await res.text();
    console.log(`  DELETE ${res.status} ${body || '(empty)'}`);
}

async function deployView(csn: CsnFile, viewName: string, headers: Record<string, string>): Promise<{ status: number; body: string }> {
    const postUrl = `${HOST}/dwaas-core/api/v1/spaces/${SPACE}/views?saveAnyway=true&allowMissingDependencies=true&deploy=true`;
    const res = await fetch(postUrl, { method: 'POST', headers, body: JSON.stringify(csn) });
    const body = await res.text();

    if (res.status === 409) {
        const putUrl = `${HOST}/dwaas-core/api/v1/spaces/${SPACE}/views/${viewName}?saveAnyway=true&allowMissingDependencies=true&deploy=true`;
        console.log('  409 Conflict — retrying with PUT');
        const putRes = await fetch(putUrl, { method: 'PUT', headers, body: JSON.stringify(csn) });
        const putBody = await putRes.text();
        return { status: putRes.status, body: putBody };
    }

    return { status: res.status, body };
}

async function checkRuntime(viewName: string, accessToken: string): Promise<boolean> {
    const url = `${HOST}/dwaas-core/api/v1/spaces/${SPACE}/views/${viewName}`;
    const res = await fetch(url, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Accept': 'application/vnd.sap.datasphere.object.content.run-time+json',
        },
    });
    const body = await res.text();
    return body.length > 10;
}

async function main() {
    // Login
    const [client, clientErr] = createClient(config);
    if (clientErr) { console.error('Client error:', clientErr.message); process.exit(1); }

    console.log('Logging in...');
    const [, loginErr] = await client.login();
    if (loginErr) { console.error('Login failed:', loginErr.message); process.exit(1); }

    // Get API tokens
    const [tokenResult, tokenErr] = await getAccessToken(HOST);
    if (tokenErr) { console.error('Token error:', tokenErr.message); process.exit(1); }

    const [csrfResult, csrfErr] = await fetchCsrf(HOST, tokenResult.accessToken);
    if (csrfErr) { console.error('CSRF error:', csrfErr.message); process.exit(1); }

    const headers = API_HEADERS(tokenResult.accessToken, csrfResult.csrf, csrfResult.cookies);
    const cleanupCsn = buildCleanupCsn(originalCsn, VIEW_NAME);

    // Step 1: Delete existing view
    console.log('\n1. Deleting existing view...');
    await deleteView(VIEW_NAME, headers);

    // Step 2: Deploy as SQL_EDITOR to clear HANA artifact
    console.log('\n2. Deploying as SQL_EDITOR (clears HANA TABLE FUNCTION artifact)...');
    const cleanupResult = await deployView(cleanupCsn, VIEW_NAME, headers);
    console.log(`  ${cleanupResult.status}: ${cleanupResult.body}`);
    if (cleanupResult.status !== 200) {
        console.error('SQL_EDITOR deploy failed — cannot proceed');
        process.exit(1);
    }

    // Step 3: Delete the SQL_EDITOR version
    console.log('\n3. Deleting SQL_EDITOR version...');
    await deleteView(VIEW_NAME, headers);

    // Step 4: Deploy original TABLE_FUNCTION CSN
    console.log('\n4. Deploying original TABLE_FUNCTION CSN...');
    const finalResult = await deployView(originalCsn, VIEW_NAME, headers);
    console.log(`  ${finalResult.status}: ${finalResult.body}`);

    if (finalResult.status !== 200) {
        console.error('\nFix FAILED. The deploy still fails after clearing the artifact.');
        process.exit(1);
    }

    // Step 5: Verify runtime
    console.log('\n5. Verifying runtime...');
    const hasRuntime = await checkRuntime(VIEW_NAME, tokenResult.accessToken);
    console.log(`  Runtime: ${hasRuntime ? 'DEPLOYED' : 'EMPTY'}`);

    if (hasRuntime) {
        console.log('\nFix SUCCEEDED. View is deployed and runtime content is present.');
    } else {
        console.error('\nDeploy returned 200 but runtime is empty — check the view in the UI.');
    }
}

main();
```

## What to Replace

The user needs to provide two values. Ask for them if not obvious from context:

1. **`VIEW_NAME`** — the technical name of the view (e.g. `ZSNAP_F01G_P_RECONACCOUNT`)
2. **CSN file path** — path to the original CSN JSON file that fails to deploy

## How It Works

1. **Delete** the stuck view from design-time
2. **Deploy as SQL_EDITOR** — this creates a regular SQL view in HANA, overwriting the lingering TABLE FUNCTION artifact that DELETE didn't clean up
3. **Delete** the SQL_EDITOR version (now HANA is clean)
4. **Deploy the original TABLE_FUNCTION CSN** — succeeds because no conflicting artifact exists
5. **Verify runtime** — confirm non-empty runtime content

## Troubleshooting

- **CSRF fetch returns 404**: The `DSP_HOST` env var likely has a trailing slash causing double-slash URLs. The script strips trailing slashes automatically.
- **SQL_EDITOR deploy also fails**: The source table referenced in the cleanup CSN may not exist. Check the `sourceTable` extracted from the TABLE_FUNCTION script and adjust the cleanup SQL manually.
- **POST returns 409**: The view still exists in design-time. The script auto-retries with PUT, but if that also fails, try another DELETE first.
- **Runtime empty after 200**: The deploy may be async. Wait a minute and re-check via the runtime API, or check the Datasphere UI.
