import { describe, test, expect, beforeAll } from 'bun:test';
import { createTestClient } from './testHelpers';
import type { BdcClient } from '../../client';

describe('endpoint discovery', () => {
    let client: BdcClient;

    beforeAll(async () => {
        client = createTestClient();
        const [, loginErr] = await client.login();
        if (loginErr) throw new Error(`Login failed: ${loginErr.message}`);
    }, 120_000);

    // Views endpoint is confirmed: /dwaas-core/api/v1/spaces/{space}/views
    test('views endpoint responds (not 401/403)', async () => {
        const [, readErr] = await client.readView('__NONEXISTENT__');
        expect(readErr).not.toBeNull();
        console.log('Views endpoint response:', readErr!.message);
        // Should be a 400/404 (object not found), not auth failure
        expect(readErr!.message).not.toContain('401');
        expect(readErr!.message).not.toContain('403');
    }, 30_000);

    // Local table endpoint — try the configured endpoint
    test('local table endpoint responds (not 401/403)', async () => {
        const [, readErr] = await client.readLocalTable('__NONEXISTENT__');
        expect(readErr).not.toBeNull();
        console.log('Local table endpoint response:', readErr!.message);
        expect(readErr!.message).not.toContain('401');
        expect(readErr!.message).not.toContain('403');
    }, 30_000);

    // Replication flow endpoint
    test('replication flow endpoint responds (not 401/403)', async () => {
        const [, readErr] = await client.readReplicationFlow('__NONEXISTENT__');
        expect(readErr).not.toBeNull();
        console.log('Replication flow endpoint response:', readErr!.message);
        expect(readErr!.message).not.toContain('401');
        expect(readErr!.message).not.toContain('403');
    }, 30_000);

    // Task chain endpoint — path by analogy, not yet confirmed. Set DSP_TEST_TASK_CHAIN to an
    // existing chain to tell a wrong path (404 here too) from a missing object.
    test('task chain endpoint responds (not 401/403)', async () => {
        const [, readErr] = await client.readTaskChain('__NONEXISTENT__');
        expect(readErr).not.toBeNull();
        console.log('Task chain endpoint response:', readErr!.message);
        expect(readErr!.message).not.toContain('401');
        expect(readErr!.message).not.toContain('403');
    }, 30_000);

    // Data access control endpoints (paths from the discovery document): read and list only
    test('data access control endpoint: a missing control is a 404, not 401/403', async () => {
        const [, readErr] = await client.readDataAccessControl('__NONEXISTENT__');
        expect(readErr).not.toBeNull();
        expect(readErr!.message).toContain('404');
    }, 30_000);

    test('data access controls list, one page and every page', async () => {
        const [page, pageErr] = await client.listDataAccessControls({ top: 1 });
        expect(pageErr).toBeNull();
        expect(page!.length).toBeLessThanOrEqual(1);
        const [all, allErr] = await client.listDataAccessControls();
        expect(allErr).toBeNull();
        expect(all!.length).toBeGreaterThanOrEqual(page!.length);
    }, 60_000);

    test.if(Boolean(process.env['DSP_TEST_DAC']))('data access control endpoint reads an existing control', async () => {
        const name = process.env['DSP_TEST_DAC']!;
        const [content, readErr] = await client.readDataAccessControl(name);
        expect(readErr).toBeNull();
        expect(JSON.parse(content!).definitions[name]['@DataWarehouse.dataAccessControl.definition']).toBeDefined();
    }, 30_000);

    test.if(Boolean(process.env['DSP_TEST_TASK_CHAIN']))('task chain endpoint reads an existing chain', async () => {
        const [content, readErr] = await client.readTaskChain(process.env['DSP_TEST_TASK_CHAIN']!);
        if (readErr) console.error('readTaskChain failed:', readErr.message);
        expect(readErr).toBeNull();
        expect(content).toContain('sap.dwc.taskChain');
    }, 30_000);
});
