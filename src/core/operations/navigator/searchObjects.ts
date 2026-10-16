import type { DatasphereRequestor } from '../../../types/requestor';
import type { AsyncResult } from '../../../types/result';
import { ok, err } from '../../../types/result';
import type { SearchObject, SearchOptions } from '../../../types/designObject';
import { SearchResponseSchema } from '../../../types/designObject';
import { safeJsonParse } from '../../utils/json';
import { debug } from '../../utils/logging';

const DEFAULT_TOP = 200;

// Build the search query path with proper %20 encoding
// (URLSearchParams encodes spaces as +, which the search API rejects)
function buildSearchPath(spaceName: string, searchQuery: string, top: number, skip: number): string {
    const apply = `filter(Search.search(query='${searchQuery}'))`;
    const encodedApply = encodeURIComponent(apply);
    return `/deepsea/repository/${spaceName}/search/$all?$top=${top}&$skip=${skip}&$count=true&valuehierarchy=folder_id&$apply=${encodedApply}`;
}

function buildSearchQuery(options?: SearchOptions): string {
    const parts: string[] = [];

    // Kind filter
    if (options?.kinds && options.kinds.length > 0) {
        const kindClauses = options.kinds.map(k => `kind:EQ(S):"${k}"`);
        parts.push(`(${kindClauses.join(' OR ')})`);
    }

    // Folder drill-down
    if (options?.folderId) {
        parts.push(`folder_id:CHILD_OF:"${options.folderId}"`);
    }

    const filter = parts.length > 0 ? `(${parts.join(' AND ')}) ` : '';
    const textQuery = options?.query ?? '*';
    return `SCOPE:SEARCH_DESIGN ${filter}${textQuery}`;
}

export interface SearchResult {
    objects: SearchObject[];
    totalCount: number;
}

export async function searchObjects(
    requestor: DatasphereRequestor,
    spaceName: string,
    options?: SearchOptions,
): AsyncResult<SearchResult> {
    const top = options?.top ?? DEFAULT_TOP;
    const skip = options?.skip ?? 0;
    const query = buildSearchQuery(options);

    debug(`Searching space "${spaceName}": ${query} (top=${top}, skip=${skip})`);

    const [response, reqErr] = await requestor.request({
        method: 'GET',
        path: buildSearchPath(spaceName, query, top, skip),
        headers: { 'Accept': 'application/json' },
    });

    if (reqErr) return err(reqErr);
    if (!response) return err(new Error('searchObjects: No response'));

    const body = await response.text();
    if (!response.ok) return err(new Error(`searchObjects: HTTP ${response.status} — ${body.substring(0, 500)}`));

    const [parsed, parseErr] = safeJsonParse(body, SearchResponseSchema);
    if (parseErr) return err(new Error(`searchObjects: parse failed — ${parseErr.message}`));

    const totalCount = parsed['@odata.count'] ?? parsed.value.length;

    debug(`Search returned ${parsed.value.length} objects (${totalCount} total)`);
    return ok({ objects: parsed.value, totalCount });
}
