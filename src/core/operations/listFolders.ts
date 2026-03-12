import type { DatasphereRequestor } from '../../types/requestor';
import type { AsyncResult } from '../../types/result';
import { ok, err } from '../../types/result';
import type { SpaceFolder } from '../../types/designObject';
import { DESIGN_OBJECT_KINDS } from '../../types/designObject';
import { searchObjects } from './searchObjects';
import { debug } from '../utils/logging';

export async function listFolders(
    requestor: DatasphereRequestor,
    spaceName: string,
    parentFolderId?: string,
): AsyncResult<SpaceFolder[]> {
    debug(`Listing folders in space "${spaceName}"${parentFolderId ? ` under ${parentFolderId}` : ''}...`);

    const [result, searchErr] = await searchObjects(requestor, spaceName, {
        kinds: [DESIGN_OBJECT_KINDS.folder],
        folderId: parentFolderId,
        top: 500,
    });
    if (searchErr) return err(searchErr);

    const folders: SpaceFolder[] = result.objects.map(obj => ({
        name: obj.name,
        id: obj.id,
        displayName: obj.business_name ?? obj.folder_name,
        parentId: obj.folder_id,
    }));

    debug(`Found ${folders.length} folders`);
    return ok(folders);
}
