import type { AsyncResult } from '../../types/result';
import { ok, err } from '../../types/result';

export async function safeFetch(input: string | URL, init?: RequestInit): AsyncResult<Response> {
    try {
        const response = await fetch(input, init);
        return ok(response);
    } catch (e) {
        return err(e instanceof Error ? e : new Error(String(e)));
    }
}
