import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { createTestClient, safeDelete } from './testHelpers';
import type { BdcClient } from '../../client';
import type { CsnFile } from '../../types/csn';

const TEST_TABLE_NAME = 'ZTEST_CATALYST_TABLE_001';

const testTableCsn: CsnFile = {
    definitions: {
        [TEST_TABLE_NAME]: {
            kind: 'entity',
            elements: {
                ID: { key: true, notNull: true, type: 'cds.String', length: 36 },
                VALUE: { key: false, type: 'cds.String', length: 255 },
            },
            '@EndUserText.label': 'Catalyst Test Table',
        },
    },
    version: { csn: '1.0' },
    meta: { creator: 'Catalyst BDC Test' },
    $version: '1.0',
};

describe('local table CRUD lifecycle', () => {
    let client: BdcClient;

    beforeAll(async () => {
        client = createTestClient();
        const [, loginErr] = await client.login();
        if (loginErr) throw new Error(`Login failed: ${loginErr.message}`);

        await safeDelete(client, 'local-table', TEST_TABLE_NAME);
    }, 120_000);

    afterAll(async () => {
        if (!client) return;
        await safeDelete(client, 'local-table', TEST_TABLE_NAME);
    }, 60_000);

    test('importCsn (create local table)', async () => {
        const [result, importErr] = await client.importCsn(testTableCsn);
        if (importErr) console.error('importCsn failed:', importErr.message);
        expect(importErr).toBeNull();
        expect(result).not.toBeNull();
        expect(result!.objectIds.length).toBeGreaterThan(0);
    }, 60_000);

    test('readLocalTable', async () => {
        const [result, readErr] = await client.readLocalTable(TEST_TABLE_NAME);
        if (readErr) console.error('readLocalTable failed:', readErr.message);
        expect(readErr).toBeNull();
        expect(result).not.toBeNull();
        expect(result).toContain(TEST_TABLE_NAME);
    }, 30_000);

    test('objectExists returns true', async () => {
        const [exists, existsErr] = await client.objectExists('local-table', TEST_TABLE_NAME);
        expect(existsErr).toBeNull();
        expect(exists).toBe(true);
    }, 30_000);

    test('deleteLocalTable', async () => {
        const [result, deleteErr] = await client.deleteLocalTable(TEST_TABLE_NAME);
        if (deleteErr) console.error('deleteLocalTable failed:', deleteErr.message);
        expect(deleteErr).toBeNull();
    }, 30_000);

    test('objectExists returns false after delete', async () => {
        const [exists, existsErr] = await client.objectExists('local-table', TEST_TABLE_NAME);
        expect(existsErr).toBeNull();
        expect(exists).toBe(false);
    }, 30_000);
});
