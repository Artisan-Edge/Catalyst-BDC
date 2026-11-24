import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { z } from 'zod';
import { createTestClient, safeDelete } from './testHelpers';
import type { BdcClient } from '../../client';
import type { CsnFile } from '../../types/csn';

// Writes to the tenant. The control is a copy of an existing one (DSP_TEST_DAC), so it reads the same
// permissions view; the test is skipped without it
const SOURCE_DAC = process.env['DSP_TEST_DAC'] ?? '';
const TEST_DAC_NAME = 'ZTEST_CATALYST_DAC_001';
const BASE_VIEW = 'ZTEST_CATALYST_VIEW_DEL_BASE';
const CONSUMER_VIEW = 'ZTEST_CATALYST_VIEW_DEL_USER';

const ControlSchema = z.object({ definitions: z.record(z.string(), z.record(z.string(), z.unknown())) });

function viewCsn(name: string, query: string): CsnFile {
    return {
        definitions: {
            [name]: {
                kind: 'entity',
                elements: { ID: { key: true, notNull: true, type: 'cds.String', length: 10 } },
                '@EndUserText.label': 'Catalyst Test View',
                '@DataWarehouse.sqlEditor.query': query,
            },
        },
    };
}

describe.if(Boolean(SOURCE_DAC))('data access control CRUD lifecycle', () => {
    let client: BdcClient;
    let copy: CsnFile;

    beforeAll(async () => {
        client = createTestClient();
        const [, loginErr] = await client.login();
        if (loginErr) throw new Error(`Login failed: ${loginErr.message}`);
        await safeDelete(client, 'data-access-control', TEST_DAC_NAME);

        const [content, readErr] = await client.readDataAccessControl(SOURCE_DAC);
        if (readErr) throw readErr;
        const source = ControlSchema.parse(JSON.parse(content)).definitions[SOURCE_DAC];
        copy = { definitions: { [TEST_DAC_NAME]: { ...source, kind: 'entity', '@EndUserText.label': 'Catalyst Test Control' } } };
    }, 120_000);

    afterAll(async () => {
        if (!client) return;
        await safeDelete(client, 'data-access-control', TEST_DAC_NAME);
    }, 60_000);

    test('createDataAccessControl', async () => {
        const [, createErr] = await client.createDataAccessControl(copy);
        if (createErr) console.error('createDataAccessControl failed:', createErr.message);
        expect(createErr).toBeNull();
    }, 120_000);

    test('readDataAccessControl returns the definitions that were saved', async () => {
        const [content, readErr] = await client.readDataAccessControl(TEST_DAC_NAME);
        expect(readErr).toBeNull();
        expect(ControlSchema.parse(JSON.parse(content!)).definitions[TEST_DAC_NAME]).toBeDefined();
    }, 30_000);

    test('listDataAccessControls names it', async () => {
        const [names, listErr] = await client.listDataAccessControls({ technicalNames: [TEST_DAC_NAME] });
        expect(listErr).toBeNull();
        expect(names).toContain(TEST_DAC_NAME);
    }, 30_000);

    test('updateDataAccessControl', async () => {
        const [, updateErr] = await client.updateDataAccessControl(TEST_DAC_NAME, copy);
        if (updateErr) console.error('updateDataAccessControl failed:', updateErr.message);
        expect(updateErr).toBeNull();
    }, 120_000);

    test('deleteDataAccessControl (not forced), then it is gone', async () => {
        const [, deleteErr] = await client.deleteDataAccessControl(TEST_DAC_NAME);
        expect(deleteErr).toBeNull();
        const [exists, existsErr] = await client.objectExists('data-access-control', TEST_DAC_NAME);
        expect(existsErr).toBeNull();
        expect(exists).toBe(false);
    }, 60_000);
});

describe('deleteView with { deleteAnyway: false }', () => {
    let client: BdcClient;

    beforeAll(async () => {
        client = createTestClient();
        const [, loginErr] = await client.login();
        if (loginErr) throw new Error(`Login failed: ${loginErr.message}`);
        await safeDelete(client, 'view', CONSUMER_VIEW);
        await safeDelete(client, 'view', BASE_VIEW);
    }, 120_000);

    afterAll(async () => {
        if (!client) return;
        await safeDelete(client, 'view', CONSUMER_VIEW);
        await safeDelete(client, 'view', BASE_VIEW);
    }, 60_000);

    test('is refused while another view reads it, and deletes once nothing does', async () => {
        const [, baseErr] = await client.importCsn(viewCsn(BASE_VIEW, "SELECT 'test' AS \"ID\" FROM DUMMY"));
        expect(baseErr).toBeNull();
        const [, consumerErr] = await client.importCsn(viewCsn(CONSUMER_VIEW, `SELECT "ID" FROM "${BASE_VIEW}"`));
        expect(consumerErr).toBeNull();

        const [, refusedErr] = await client.deleteView(BASE_VIEW, { deleteAnyway: false });
        expect(refusedErr).not.toBeNull();
        const [stillThere] = await client.objectExists('view', BASE_VIEW);
        expect(stillThere).toBe(true);

        expect((await client.deleteView(CONSUMER_VIEW, { deleteAnyway: false }))[1]).toBeNull();
        expect((await client.deleteView(BASE_VIEW, { deleteAnyway: false }))[1]).toBeNull();
    }, 300_000);
});
