import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { createTestClient, safeDelete } from './testHelpers';
import type { BdcClient } from '../../client';
import type { CsnFile } from '../../types/csn';

const TEST_VIEW_NAME = 'ZTEST_CATALYST_VIEW_001';

const testViewCsn: CsnFile = {
    definitions: {
        [TEST_VIEW_NAME]: {
            kind: 'entity',
            elements: {
                ID: { key: true, notNull: true, type: 'cds.String', length: 10 },
                DESCRIPTION: { key: false, type: 'cds.String', length: 100 },
            },
            '@EndUserText.label': 'Catalyst Test View',
            '@DataWarehouse.sqlEditor.query': "SELECT 'test' AS \"ID\", 'desc' AS \"DESCRIPTION\" FROM DUMMY",
        },
    },
    version: { csn: '1.0' },
    meta: { creator: 'Catalyst BDC Test' },
    $version: '1.0',
};

const updatedViewCsn: CsnFile = {
    ...testViewCsn,
    definitions: {
        [TEST_VIEW_NAME]: {
            ...testViewCsn.definitions![TEST_VIEW_NAME]!,
            '@EndUserText.label': 'Catalyst Test View (Updated)',
        },
    },
};

describe('view CRUD lifecycle', () => {
    let client: BdcClient;

    beforeAll(async () => {
        client = createTestClient();
        const [, loginErr] = await client.login();
        if (loginErr) throw new Error(`Login failed: ${loginErr.message}`);

        // Pre-cleanup in case previous run left artifacts
        await safeDelete(client, 'view', TEST_VIEW_NAME);
    }, 120_000);

    afterAll(async () => {
        if (!client) return;
        await safeDelete(client, 'view', TEST_VIEW_NAME);
    }, 60_000);

    test('createView', async () => {
        const [result, createErr] = await client.createView(testViewCsn, TEST_VIEW_NAME);
        if (createErr) console.error('createView failed:', createErr.message);
        expect(createErr).toBeNull();
        expect(result).not.toBeNull();
    }, 60_000);

    test('readView', async () => {
        const [result, readErr] = await client.readView(TEST_VIEW_NAME);
        if (readErr) console.error('readView failed:', readErr.message);
        expect(readErr).toBeNull();
        expect(result).not.toBeNull();
        expect(result).toContain(TEST_VIEW_NAME);
    }, 30_000);

    test('objectExists returns true', async () => {
        const [exists, existsErr] = await client.objectExists('view', TEST_VIEW_NAME);
        expect(existsErr).toBeNull();
        expect(exists).toBe(true);
    }, 30_000);

    test('updateView', async () => {
        const [result, updateErr] = await client.updateView(updatedViewCsn, TEST_VIEW_NAME);
        if (updateErr) console.error('updateView failed:', updateErr.message);
        expect(updateErr).toBeNull();
        expect(result).not.toBeNull();
    }, 60_000);

    test('upsertView (update path)', async () => {
        const [result, upsertErr] = await client.upsertView(testViewCsn, TEST_VIEW_NAME);
        if (upsertErr) console.error('upsertView (update) failed:', upsertErr.message);
        expect(upsertErr).toBeNull();
        expect(result).not.toBeNull();
        expect(result!.action).toBe('updated');
    }, 60_000);

    test('deleteView', async () => {
        const [result, deleteErr] = await client.deleteView(TEST_VIEW_NAME);
        if (deleteErr) console.error('deleteView failed:', deleteErr.message);
        expect(deleteErr).toBeNull();
    }, 30_000);

    test('objectExists returns false after delete', async () => {
        const [exists, existsErr] = await client.objectExists('view', TEST_VIEW_NAME);
        expect(existsErr).toBeNull();
        expect(exists).toBe(false);
    }, 30_000);

    test('upsertView (create path)', async () => {
        const [result, upsertErr] = await client.upsertView(testViewCsn, TEST_VIEW_NAME);
        if (upsertErr) console.error('upsertView (create) failed:', upsertErr.message);
        expect(upsertErr).toBeNull();
        expect(result).not.toBeNull();
        expect(result!.action).toBe('created');
    }, 60_000);
});
