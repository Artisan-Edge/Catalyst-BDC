import type { AsyncResult } from '../../types/result';
import { ok, err } from '../../types/result';

export async function checkResponse(
    response: Response | null,
    requestErr: Error | null,
    operation: string,
): AsyncResult<string> {
    if (requestErr) return err(requestErr);
    if (!response) return err(new Error(`${operation}: No response`));

    const body = await response.text();

    if (!response.ok) {
        return err(new Error(`${operation}: HTTP ${response.status} — ${body.substring(0, 500)}`));
    }

    return ok(body);
}
