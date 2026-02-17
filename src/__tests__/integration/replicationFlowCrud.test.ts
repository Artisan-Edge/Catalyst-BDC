import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { createTestClient, safeDelete } from './testHelpers';
import type { BdcClient } from '../../client';
import type { CsnFile } from '../../types/csn';
import fixture from '../assets/I_BusinessArea.json';

const csn = fixture as CsnFile;

// Discover names from fixture
const flowNames = Object.keys(csn.replicationflows ?? {});
const flowName = flowNames[0]!;
const targetTableNames = csn.replicationflows?.[flowName]?.targets
    ? Object.keys(csn.replicationflows[flowName]!.targets!)
    : [];

describe('replication flow CRUD lifecycle', () => {
    let client: BdcClient;

    beforeAll(async () => {
        client = createTestClient();
        const [, loginErr] = await client.login();
        if (loginErr) throw new Error(`Login failed: ${loginErr.message}`);

        // Pre-cleanup
        await safeDelete(client, 'replication-flow', flowName);
        for (const tableName of targetTableNames) {
            await safeDelete(client, 'local-table', tableName);
        }
    }, 120_000);

    afterAll(async () => {
        if (!client) return;
        await safeDelete(client, 'replication-flow', flowName);
        for (const tableName of targetTableNames) {
            await safeDelete(client, 'local-table', tableName);
        }
    }, 180_000);

    test('create prerequisite local tables', async () => {
        for (const tableName of targetTableNames) {
            const [result, tableErr] = await client.createLocalTable(csn, tableName);
            if (tableErr) console.error(`createLocalTable "${tableName}" failed:`, tableErr.message);
            expect(tableErr).toBeNull();
        }
    }, 120_000);

    test('createReplicationFlow', async () => {
        const [result, createErr] = await client.createReplicationFlow(csn, flowName);
        if (createErr) console.error('createReplicationFlow failed:', createErr.message);
        expect(createErr).toBeNull();
        expect(result).not.toBeNull();
    }, 60_000);

    test('readReplicationFlow', async () => {
        const [result, readErr] = await client.readReplicationFlow(flowName);
        if (readErr) console.error('readReplicationFlow failed:', readErr.message);
        expect(readErr).toBeNull();
        expect(result).not.toBeNull();
    }, 30_000);

    test('objectExists returns true', async () => {
        const [exists, existsErr] = await client.objectExists('replication-flow', flowName);
        expect(existsErr).toBeNull();
        expect(exists).toBe(true);
    }, 30_000);

    test('upsertReplicationFlow (update path)', async () => {
        const [result, upsertErr] = await client.upsertReplicationFlow(csn, flowName);
        if (upsertErr) console.error('upsertReplicationFlow (update) failed:', upsertErr.message);
        expect(upsertErr).toBeNull();
        expect(result).not.toBeNull();
        expect(result!.action).toBe('updated');
    }, 60_000);

    test('runReplicationFlow', async () => {
        const [result, runErr] = await client.runReplicationFlow(flowName);
        // 409 (already running) is acceptable
        if (runErr && !runErr.message.includes('409')) {
            console.error('runReplicationFlow failed:', runErr.message);
            expect(runErr).toBeNull();
        }
        if (result) {
            expect(result.runStatus).toBeTruthy();
        }
    }, 60_000);

    test('deleteReplicationFlow', async () => {
        const [result, deleteErr] = await client.deleteReplicationFlow(flowName);
        if (deleteErr) console.error('deleteReplicationFlow failed:', deleteErr.message);
        expect(deleteErr).toBeNull();
    }, 30_000);

    test('objectExists returns false after delete', async () => {
        const [exists, existsErr] = await client.objectExists('replication-flow', flowName);
        expect(existsErr).toBeNull();
        expect(exists).toBe(false);
    }, 30_000);
});
