import 'dotenv/config';
import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { createClient } from '../../client';
import { resolveDependencies } from '../../core/csn/resolveDeps';
import { DSP_OBJECT_TYPES } from '../../types/objectTypes';
import type { CsnFile } from '../../types/csn';
import type { BdcConfig } from '../../types/config';
import fixture from '../assets/I_BusinessArea.json';

const csn = fixture as CsnFile;

const config: BdcConfig = {
    host: process.env.DSP_HOST!,
    space: process.env.DSP_SPACE!,
    verbose: true,
    oauth: { optionsFile: './oauth.json' },
};

// Dynamically discover names from the fixture
const flowNames = Object.keys(csn.replicationflows ?? {});
const flowName = flowNames[0]!;
const targetTableNames = csn.replicationflows?.[flowName]?.targets
    ? Object.keys(csn.replicationflows[flowName].targets!)
    : [];

describe('resolveDependencies', () => {
    test('resolves target local table names from replication flow', () => {
        const deps = resolveDependencies(csn, flowName, DSP_OBJECT_TYPES['replication-flow']);
        expect(deps).toEqual(targetTableNames);
        expect(deps.length).toBeGreaterThan(0);
    });

    test('returns empty array for view type (no preDeps)', () => {
        const deps = resolveDependencies(csn, flowName, DSP_OBJECT_TYPES['view']);
        expect(deps).toEqual([]);
    });
});

describe('createReplicationFlow', () => {
    const [client, clientErr] = createClient(config);

    beforeAll(async () => {
        expect(clientErr).toBeNull();
        const [_, loginErr] = await client!.login();
        if (loginErr) {
            console.error('Login failed:', loginErr.message);
        }
        expect(loginErr).toBeNull();
    }, 120_000);

    afterAll(async () => {
        if (!client) return;

        // Delete replication flow first (depends on local table)
        console.log(`Cleaning up: deleting replication flow "${flowName}"...`);
        const [_, flowDelErr] = await client.deleteObject('replication-flow', flowName);
        if (flowDelErr) console.error('Failed to delete replication flow:', flowDelErr.message);

        // Delete dependency local tables
        for (const tableName of targetTableNames) {
            console.log(`Cleaning up: deleting local table "${tableName}"...`);
            const [__, tableDelErr] = await client.deleteObject('local-table', tableName);
            if (tableDelErr) console.error(`Failed to delete local table "${tableName}":`, tableDelErr.message);
        }
    }, 180_000);

    test('creates dependency local tables then the replication flow', async () => {
        // Create dependency local tables first
        for (const tableName of targetTableNames) {
            const [_, tableErr] = await client!.createLocalTable(csn, tableName);
            if (tableErr) {
                console.error(`createLocalTable "${tableName}" failed:`, tableErr.message);
            }
            expect(tableErr).toBeNull();
        }

        // Create the replication flow
        const [result, error] = await client!.createReplicationFlow(csn, flowName);

        if (error) {
            console.error('createReplicationFlow failed:', error.message);
        }

        expect(error).toBeNull();
        expect(result).not.toBeNull();
        expect(result!.output).toBeTruthy();
        expect(result!.action).toBe('created');
    }, 60_000);

    test('returns error for missing object in CSN', async () => {
        const [result, error] = await client!.createReplicationFlow(csn, 'NonExistent');
        expect(result).toBeNull();
        expect(error).not.toBeNull();
        expect(error!.message).toContain('NonExistent');
    });
});
