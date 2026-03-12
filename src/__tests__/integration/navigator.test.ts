import { describe, test, expect, beforeAll } from 'bun:test';
import { createTestClient } from './testHelpers';
import type { BdcClient } from '../../client';
import { DESIGN_OBJECT_KINDS } from '../../types/designObject';

describe('navigator', () => {
    let client: BdcClient;

    beforeAll(async () => {
        client = createTestClient();
        const [, loginErr] = await client.login();
        if (loginErr) throw new Error(`Login failed: ${loginErr.message}`);
    }, 120_000);

    test('listObjects returns non-empty array with rich metadata', async () => {
        const [objects, listErr] = await client.listObjects();
        expect(listErr).toBeNull();
        expect(objects).not.toBeNull();
        expect(objects!.length).toBeGreaterThan(0);

        for (const obj of objects!.slice(0, 5)) {
            expect(obj.id).toBeTruthy();
            expect(obj.name).toBeTruthy();
            expect(obj.kind).toBeTruthy();
            expect(obj.space_id).toBeTruthy();
        }
    }, 30_000);

    test('listObjects excludes folders and space by default', async () => {
        const [objects, listErr] = await client.listObjects();
        expect(listErr).toBeNull();
        expect(objects).not.toBeNull();

        const folderCount = objects!.filter(o =>
            o.kind === DESIGN_OBJECT_KINDS.folder || o.kind === DESIGN_OBJECT_KINDS.space,
        ).length;
        expect(folderCount).toBe(0);
    }, 30_000);

    test('listObjects filters by kind', async () => {
        const [flows, listErr] = await client.listObjects({
            kind: DESIGN_OBJECT_KINDS.replicationFlow,
        });
        expect(listErr).toBeNull();
        expect(flows).not.toBeNull();
        expect(flows!.length).toBeGreaterThan(0);

        for (const flow of flows!) {
            expect(flow.kind).toBe(DESIGN_OBJECT_KINDS.replicationFlow);
        }
    }, 30_000);

    test('searchObjects with text query', async () => {
        const [result, searchErr] = await client.searchObjects({ query: 'Account', top: 10 });
        expect(searchErr).toBeNull();
        expect(result).not.toBeNull();
        expect(result!.totalCount).toBeGreaterThan(0);
        expect(result!.objects.length).toBeGreaterThan(0);
    }, 30_000);

    test('searchObjects with folder drill-down', async () => {
        // First get folders
        const [folders, folderErr] = await client.listFolders();
        expect(folderErr).toBeNull();
        expect(folders).not.toBeNull();
        expect(folders!.length).toBeGreaterThan(0);

        // Browse into the first folder
        const folder = folders![0]!;
        const [result, searchErr] = await client.searchObjects({ folderId: folder.id, top: 10 });
        expect(searchErr).toBeNull();
        expect(result).not.toBeNull();
        // Folder may have contents or subfolders
        expect(result!.totalCount).toBeGreaterThanOrEqual(0);
    }, 30_000);

    test('listObjects filters by glob pattern', async () => {
        const [results, listErr] = await client.listObjects({ pattern: 'I_*Replication' });
        expect(listErr).toBeNull();
        expect(results).not.toBeNull();
        expect(results!.length).toBeGreaterThan(0);

        for (const obj of results!) {
            expect(obj.name).toStartWith('I_');
            expect(obj.name).toEndWith('Replication');
        }
    }, 30_000);

    test('listFolders returns folders with display names', async () => {
        const [folders, listErr] = await client.listFolders();
        expect(listErr).toBeNull();
        expect(folders).not.toBeNull();
        expect(folders!.length).toBeGreaterThan(0);

        for (const folder of folders!) {
            expect(folder.id).toBeTruthy();
            expect(folder.name).toBeTruthy();
        }
    }, 30_000);

    test('listFolders can drill into a parent folder', async () => {
        const [allFolders] = await client.listFolders();
        if (!allFolders || allFolders.length === 0) return;

        // Find a folder that has subfolders
        for (const folder of allFolders) {
            const [subFolders, subErr] = await client.listFolders(folder.id);
            if (subErr) continue;
            if (subFolders && subFolders.length > 0) {
                // Found subfolders — verify they reference the parent
                for (const sub of subFolders) {
                    expect(sub.parentId).toBe(folder.id);
                }
                return;
            }
        }
        // No nested folders in this space — that's fine
    }, 60_000);
});
