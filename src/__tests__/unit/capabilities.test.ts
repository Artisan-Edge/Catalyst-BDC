import { describe, it, expect } from 'bun:test';
import { createClient, CLIENT_CAPABILITIES } from '../../index';

describe('client capabilities', () => {
    // Catalyst-CLI deletes task chains without forcing only when the linked build says it can
    it('a client says its task chain delete honours deleteAnyway', () => {
        const [client, error] = createClient({ host: 'https://tenant.example', space: 'SPACE', oauth: { clientId: 'id', clientSecret: 'secret', authorizationUrl: 'https://auth.example/authorize', tokenUrl: 'https://auth.example/token' } });
        expect(error).toBeNull();
        expect(client?.capabilities).toContain('task-chain-delete-options');
        expect(CLIENT_CAPABILITIES).toEqual(['task-chain-delete-options']);
    });
});
