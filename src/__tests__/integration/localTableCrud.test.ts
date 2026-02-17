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

const updatedTableCsn: CsnFile = {
    ...testTableCsn,
    definitions: {
        [TEST_TABLE_NAME]: {
            ...testTableCsn.definitions![TEST_TABLE_NAME]!,
            '@EndUserText.label': 'Catalyst Test Table (Updated)',
        },
    },
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

    test('createLocalTable', async () => {
        const [result, createErr] = await client.createLocalTable(testTableCsn, TEST_TABLE_NAME);
        if (createErr) console.error('createLocalTable failed:', createErr.message);
        expect(createErr).toBeNull();
        expect(result).not.toBeNull();
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

    test('updateLocalTable', async () => {
        const [result, updateErr] = await client.updateLocalTable(updatedTableCsn, TEST_TABLE_NAME);
        if (updateErr) console.error('updateLocalTable failed:', updateErr.message);
        expect(updateErr).toBeNull();
        expect(result).not.toBeNull();
    }, 60_000);

    test('upsertLocalTable (update path)', async () => {
        const [result, upsertErr] = await client.upsertLocalTable(testTableCsn, TEST_TABLE_NAME);
        if (upsertErr) console.error('upsertLocalTable (update) failed:', upsertErr.message);
        expect(upsertErr).toBeNull();
        expect(result).not.toBeNull();
        expect(result!.action).toBe('updated');
    }, 60_000);

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

    test('upsertLocalTable (create path)', async () => {
        const [result, upsertErr] = await client.upsertLocalTable(testTableCsn, TEST_TABLE_NAME);
        if (upsertErr) console.error('upsertLocalTable (create) failed:', upsertErr.message);
        expect(upsertErr).toBeNull();
        expect(result).not.toBeNull();
        expect(result!.action).toBe('created');
    }, 60_000);
});
