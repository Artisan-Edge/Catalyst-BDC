import type { AsyncResult } from '../types/result';

// Wrap `load` so callers that arrive while a call is in flight share its result instead of
// starting their own. The next call after it settles starts fresh. While one is in flight,
// later callers' arguments are ignored.
export function singleFlight<A extends unknown[], T>(load: (...args: A) => AsyncResult<T>): (...args: A) => AsyncResult<T> {
    let inFlight: AsyncResult<T> | null = null;
    return (...args: A) => {
        inFlight ??= load(...args).finally(() => { inFlight = null; });
        return inFlight;
    };
}
