import type { DatasphereRequestor } from '../../types/requestor';
import type { AsyncResult } from '../../types/result';
import { ok, err } from '../../types/result';
import type { SearchObject, ListObjectsOptions } from '../../types/designObject';
import { DESIGN_OBJECT_KINDS } from '../../types/designObject';
import { searchObjects } from './searchObjects';
import { globToRegex } from '../utils/glob';
import { debug } from '../utils/logging';

const PAGE_SIZE = 500;

export async function listObjects(
    requestor: DatasphereRequestor,
    spaceName: string,
    options?: ListObjectsOptions,
): AsyncResult<SearchObject[]> {
    debug(`Listing objects in space "${spaceName}"...`);

    // Map kind filter to search API
    const kinds = options?.kind
        ? (Array.isArray(options.kind) ? options.kind : [options.kind])
        : undefined;

    // Auto-paginate to fetch all results
    const allObjects: SearchObject[] = [];
    let skip = 0;

    for (;;) {
        const [result, searchErr] = await searchObjects(requestor, spaceName, {
            kinds,
            top: PAGE_SIZE,
            skip,
        });
        if (searchErr) return err(searchErr);

        allObjects.push(...result.objects);

        if (allObjects.length >= result.totalCount || result.objects.length < PAGE_SIZE) break;
        skip += PAGE_SIZE;
    }

    let objects = allObjects;

    // Exclude folders and space object by default
    if (options?.excludeFolders !== false) {
        objects = objects.filter(obj =>
            obj.kind !== DESIGN_OBJECT_KINDS.folder && obj.kind !== DESIGN_OBJECT_KINDS.space,
        );
    }

    // Filter by glob pattern on name
    if (options?.pattern) {
        const regex = globToRegex(options.pattern);
        objects = objects.filter(obj => regex.test(obj.name));
    }

    debug(`Found ${objects.length} objects`);
    return ok(objects);
}
