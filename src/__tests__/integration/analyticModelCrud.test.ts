import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { createTestClient, safeDelete } from './testHelpers';
import type { BdcClient } from '../../client';
import type { CsnFile } from '../../types/csn';

const TEST_MODEL_NAME = 'ZTEST_CATALYST_AMODEL_001';

const testModelCsn: CsnFile = {
    definitions: {
        [TEST_MODEL_NAME]: {
            kind: 'entity',
            elements: {
                ID: { key: true, notNull: true, type: 'cds.String', length: 10 },
                AMOUNT: { key: false, type: 'cds.Decimal', precision: 15, scale: 2 },
            },
            '@EndUserText.label': 'Catalyst Test Analytic Model',
        },
    },
    version: { csn: '1.0' },
    meta: { creator: 'Catalyst BDC Test' },
    $version: '1.0',
};

const updatedModelCsn: CsnFile = {
    ...testModelCsn,
    definitions: {
        [TEST_MODEL_NAME]: {
            ...testModelCsn.definitions![TEST_MODEL_NAME]!,
            '@EndUserText.label': 'Catalyst Test Analytic Model (Updated)',
        },
    },
};

describe('analytic model CRUD lifecycle', () => {
    let client: BdcClient;

    beforeAll(async () => {
        client = createTestClient();
        const [, loginErr] = await client.login();
        if (loginErr) throw new Error(`Login failed: ${loginErr.message}`);

        // Pre-cleanup in case previous run left artifacts
        await safeDelete(client, 'analytic-model', TEST_MODEL_NAME);
    }, 120_000);

    afterAll(async () => {
        if (!client) return;
        await safeDelete(client, 'analytic-model', TEST_MODEL_NAME);
    }, 60_000);

    test('createAnalyticModel', async () => {
        const [result, createErr] = await client.createAnalyticModel(testModelCsn, TEST_MODEL_NAME);
        if (createErr) console.error('createAnalyticModel failed:', createErr.message);
        expect(createErr).toBeNull();
        expect(result).not.toBeNull();
    }, 60_000);

    test('readAnalyticModel', async () => {
        const [result, readErr] = await client.readAnalyticModel(TEST_MODEL_NAME);
        if (readErr) console.error('readAnalyticModel failed:', readErr.message);
        expect(readErr).toBeNull();
        expect(result).not.toBeNull();
        expect(result).toContain(TEST_MODEL_NAME);
    }, 30_000);

    test('objectExists returns true', async () => {
        const [exists, existsErr] = await client.objectExists('analytic-model', TEST_MODEL_NAME);
        expect(existsErr).toBeNull();
        expect(exists).toBe(true);
    }, 30_000);

    test('updateAnalyticModel', async () => {
        const [result, updateErr] = await client.updateAnalyticModel(updatedModelCsn, TEST_MODEL_NAME);
        if (updateErr) console.error('updateAnalyticModel failed:', updateErr.message);
        expect(updateErr).toBeNull();
        expect(result).not.toBeNull();
    }, 60_000);

    test('upsertAnalyticModel (update path)', async () => {
        const [result, upsertErr] = await client.upsertAnalyticModel(testModelCsn, TEST_MODEL_NAME);
        if (upsertErr) console.error('upsertAnalyticModel (update) failed:', upsertErr.message);
        expect(upsertErr).toBeNull();
        expect(result).not.toBeNull();
        expect(result!.action).toBe('updated');
    }, 60_000);

    test('deleteAnalyticModel', async () => {
        const [result, deleteErr] = await client.deleteAnalyticModel(TEST_MODEL_NAME);
        if (deleteErr) console.error('deleteAnalyticModel failed:', deleteErr.message);
        expect(deleteErr).toBeNull();
    }, 30_000);

    test('objectExists returns false after delete', async () => {
        const [exists, existsErr] = await client.objectExists('analytic-model', TEST_MODEL_NAME);
        expect(existsErr).toBeNull();
        expect(exists).toBe(false);
    }, 30_000);

    test('upsertAnalyticModel (create path)', async () => {
        const [result, upsertErr] = await client.upsertAnalyticModel(testModelCsn, TEST_MODEL_NAME);
        if (upsertErr) console.error('upsertAnalyticModel (create) failed:', upsertErr.message);
        expect(upsertErr).toBeNull();
        expect(result).not.toBeNull();
        expect(result!.action).toBe('created');
    }, 60_000);
});
