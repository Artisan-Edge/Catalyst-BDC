import type { CsrfCache } from './types';
import type { AsyncResult } from '../types/result';
import { ok, err } from '../types/result';
import { fetchCsrf } from '../core/http/fetchCsrf';

export async function ensureCsrf(
    csrfCache: CsrfCache | null,
    host: string,
    accessToken: string,
): AsyncResult<CsrfCache> {
    if (csrfCache) return ok(csrfCache);

    const [csrfResult, csrfErr] = await fetchCsrf(host, accessToken);
    if (csrfErr) return err(csrfErr);

    return ok(csrfResult);
}
