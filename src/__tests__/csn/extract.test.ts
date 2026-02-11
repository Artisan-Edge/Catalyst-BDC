import { describe, test, expect } from 'bun:test';
import { extractObject } from '../../core/csn/extract';
import type { CsnFile } from '../../types/csn';
import fixture from '../assets/I_BusinessArea.json';

const csn = fixture as CsnFile;

// Dynamically discover names from fixture
const definitionName = Object.keys(csn.definitions ?? {})[0]!;
const flowName = Object.keys(csn.replicationflows ?? {})[0]!;

describe('extractObject', () => {
    test('extracts a single definition from CSN', () => {
        const [result, error] = extractObject(csn, 'definitions', definitionName);
        expect(error).toBeNull();
        expect(result).not.toBeNull();
        expect(result!.definitions).toHaveProperty(definitionName);
        expect(Object.keys(result!.definitions!)).toHaveLength(1);
        expect(result!.version).toEqual(csn.version);
        expect(result!.meta).toEqual(csn.meta);
        expect(result!.$version).toEqual(csn.$version);
    });

    test('extracts a replication flow from CSN', () => {
        const [result, error] = extractObject(csn, 'replicationflows', flowName);
        expect(error).toBeNull();
        expect(result).not.toBeNull();
        expect(result!.replicationflows).toHaveProperty(flowName);
    });

    test('returns error for missing CSN key', () => {
        const [result, error] = extractObject(csn, 'nonexistent', definitionName);
        expect(result).toBeNull();
        expect(error).not.toBeNull();
        expect(error!.message).toContain('nonexistent');
        expect(error!.message).toContain('not found');
    });

    test('returns error for missing object name', () => {
        const [result, error] = extractObject(csn, 'definitions', 'NonExistentObject');
        expect(result).toBeNull();
        expect(error).not.toBeNull();
        expect(error!.message).toContain('NonExistentObject');
        expect(error!.message).toContain('not found');
    });
});
