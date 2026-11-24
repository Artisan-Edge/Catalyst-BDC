import { z } from 'zod';
import type { AsyncResult } from '../../../types/result';
import { ok, err } from '../../../types/result';
import type { DatasphereRequestor } from '../../../types/requestor';
import type { ListOptions } from '../../../types/operationOptions';
import { checkResponse } from '../../http/checkResponse';
import { DATASPHERE_OBJECT_TYPES } from '../../../types/objectTypes';
import { debug } from '../../utils/logging';
import { safeJsonParse } from '../../utils/json';

// Response shape (select=technicalName): [{ "technicalName": "NAME" }, ...]
const ListResponseSchema = z.array(z.object({ technicalName: z.string() }));

// The page size SAP's CLI uses by default (the discovery document's default for top)
const PAGE_SIZE = 25;
const MAX_PAGES = 400;

async function listPage(requestor: DatasphereRequestor, space: string, top: number, skip: number, technicalNames: string[] | undefined): AsyncResult<string[]> {
    const objectType = DATASPHERE_OBJECT_TYPES['data-access-control'];
    const params: Record<string, string> = { select: 'technicalName', top: String(top), skip: String(skip) };
    if (technicalNames && technicalNames.length > 0) params['technicalNames'] = technicalNames.join(',');

    const [response, reqErr] = await requestor.request({
        method: 'GET',
        path: `/dwaas-core/api/v1/spaces/${encodeURIComponent(space)}/${objectType.endpoint}`,
        params,
    });
    const [body, bodyErr] = await checkResponse(response, reqErr, 'List data access controls');
    if (bodyErr) return err(bodyErr);

    const [entries, parseErr] = safeJsonParse(body, ListResponseSchema);
    if (parseErr) return err(new Error(`List data access controls: ${parseErr.message}`));
    return ok(entries.map(entry => entry.technicalName));
}

// Technical names of the space's controls: one page with `top`, else every page
export async function listDataAccessControls(
    requestor: DatasphereRequestor,
    space: string,
    options: ListOptions = {},
): AsyncResult<string[]> {
    const skip = options.skip ?? 0;
    debug(`Listing data access controls in space "${space}"...`);
    if (options.top !== undefined) return listPage(requestor, space, options.top, skip, options.technicalNames);

    const names: string[] = [];
    for (let page = 0; page < MAX_PAGES; page++) {
        const [batch, pageErr] = await listPage(requestor, space, PAGE_SIZE, skip + page * PAGE_SIZE, options.technicalNames);
        if (pageErr) return err(pageErr);
        names.push(...batch);
        if (batch.length < PAGE_SIZE) return ok(names);
    }
    return err(new Error(`List data access controls: still more after ${MAX_PAGES} pages of ${PAGE_SIZE}; is skip ignored?`));
}
