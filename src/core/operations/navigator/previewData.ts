import { z } from 'zod';
import type { DatasphereRequestor } from '../../../types/requestor';
import type { AsyncResult } from '../../../types/result';
import { ok, err } from '../../../types/result';
import { safeJsonParse } from '../../utils/json';
import { debug } from '../../utils/logging';

const DEFAULT_TOP = 200;
const DEFAULT_SKIP = 0;

export interface DataPreviewOptions {
    select?: string[];
    filter?: string;
    top?: number;
    skip?: number;
}

export interface DataPreviewResult {
    rows: Record<string, unknown>[];
    count: number | null;
}

// OData v2: { d: { results: [...], __count?: "123" } }
const ODataV2Schema = z.object({
    d: z.object({
        results: z.array(z.record(z.unknown())),
        __count: z.string().optional(),
    }),
});

// OData v4: { value: [...], @odata.count?: 123 }
const ODataV4Schema = z.object({
    value: z.array(z.record(z.unknown())),
    '@odata.count': z.number().optional(),
});

const ODataResponseSchema = z.union([ODataV2Schema, ODataV4Schema]);

function normalizeResponse(parsed: z.infer<typeof ODataResponseSchema>): DataPreviewResult {
    if ('d' in parsed) {
        const rows = parsed.d.results.map(stripODataMetadata);
        const count = parsed.d.__count ? parseInt(parsed.d.__count, 10) : null;
        return { rows, count };
    }
    return {
        rows: parsed.value.map(stripODataMetadata),
        count: parsed['@odata.count'] ?? null,
    };
}

function stripODataMetadata(row: Record<string, unknown>): Record<string, unknown> {
    const cleaned: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
        if (key === '__metadata') continue;
        cleaned[key] = value;
    }
    return cleaned;
}

function buildPreviewPath(spaceName: string, viewName: string, options?: DataPreviewOptions): string {
    const top = options?.top ?? DEFAULT_TOP;
    const skip = options?.skip ?? DEFAULT_SKIP;

    const params: string[] = [
        `disableLazyLoading=true`,
        `$skip=${skip}`,
        `$top=${top}`,
    ];

    if (options?.select && options.select.length > 0) {
        params.push(`$select=${options.select.join(',')}`);
    }

    if (options?.filter) {
        params.push(`$filter=${encodeURIComponent(options.filter)}`);
    }

    return `/dwaas-core/data-access/instant/${spaceName}/${viewName}/${viewName}?${params.join('&')}`;
}

export async function previewData(
    requestor: DatasphereRequestor,
    spaceName: string,
    viewName: string,
    options?: DataPreviewOptions,
): AsyncResult<DataPreviewResult> {
    const path = buildPreviewPath(spaceName, viewName, options);
    debug(`Previewing data: ${viewName} (top=${options?.top ?? DEFAULT_TOP}, skip=${options?.skip ?? DEFAULT_SKIP})`);

    const [response, reqErr] = await requestor.request({
        method: 'GET',
        path,
        headers: { 'Accept': 'application/json' },
    });

    if (reqErr) return err(reqErr);
    if (!response) return err(new Error('previewData: No response'));

    const body = await response.text();
    if (!response.ok) return err(new Error(`previewData: HTTP ${response.status} — ${body.substring(0, 500)}`));

    const [parsed, parseErr] = safeJsonParse(body, ODataResponseSchema);
    if (parseErr) return err(new Error(`previewData: ${parseErr.message}`));

    const result = normalizeResponse(parsed);
    debug(`Preview returned ${result.rows.length} rows${result.count !== null ? ` (${result.count} total)` : ''}`);

    return ok(result);
}
