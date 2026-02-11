import { z } from 'zod';
import type { Result } from '../../types/result';
import { ok, err } from '../../types/result';

export function safeJsonParse<S extends z.ZodTypeAny>(text: string, schema: S): Result<z.infer<S>> {
    let raw: unknown;
    try {
        raw = JSON.parse(text);
    } catch {
        return err(new Error(`Failed to parse JSON: ${text.slice(0, 200)}`));
    }

    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
        return err(new Error(`JSON validation failed: ${parsed.error.message}`));
    }

    return ok(parsed.data);
}
