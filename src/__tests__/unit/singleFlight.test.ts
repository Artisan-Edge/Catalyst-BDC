import { describe, it, expect } from 'bun:test';
import { singleFlight } from '../../client/singleFlight';
import { ok, err } from '../../types/result';

describe('singleFlight', () => {
    it('shares one in-flight call between concurrent callers', async () => {
        let calls = 0;
        const shared = singleFlight(async () => {
            calls++;
            await Bun.sleep(10);
            return ok(calls);
        });

        const results = await Promise.all([shared(), shared(), shared()]);

        expect(calls).toBe(1);
        expect(results.map(([value]) => value)).toEqual([1, 1, 1]);
    });

    it('starts a fresh call once the previous one has settled', async () => {
        let calls = 0;
        const shared = singleFlight(async () => ok(++calls));

        await shared();
        const [second] = await shared();

        expect(second).toBe(2);
    });

    it('does not cache a failure', async () => {
        let calls = 0;
        const shared = singleFlight(async () => (++calls === 1 ? err(new Error('first fails')) : ok(calls)));

        const [, firstError] = await shared();
        const [second] = await shared();

        expect(firstError?.message).toBe('first fails');
        expect(second).toBe(2);
    });

    it('clears after a rejection so the next call can retry', async () => {
        let calls = 0;
        const shared = singleFlight(async () => {
            if (++calls === 1) throw new Error('boom');
            return ok(calls);
        });

        await expect(shared()).rejects.toThrow('boom');
        const [second] = await shared();

        expect(second).toBe(2);
    });
});
