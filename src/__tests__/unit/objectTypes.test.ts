import { describe, it, expect } from 'bun:test';
import { DATASPHERE_OBJECT_TYPES } from '../../types/objectTypes';

describe('DATASPHERE_OBJECT_TYPES', () => {
    // Every endpoint is the SAP CLI's object type name (e.g. local-tables) without the hyphen
    it('names each endpoint after its type, plural and without hyphens', () => {
        for (const [name, type] of Object.entries(DATASPHERE_OBJECT_TYPES)) {
            const endpoint: string = type.endpoint;
            expect(endpoint).toBe(`${name.replaceAll('-', '')}s`);
        }
    });

    it('registers task chains under the taskchains endpoint and CSN key', () => {
        expect(DATASPHERE_OBJECT_TYPES['task-chain']).toEqual({ endpoint: 'taskchains', csnKey: 'taskchains' });
    });
});
