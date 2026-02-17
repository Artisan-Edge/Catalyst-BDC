import type { CsnFile } from '../../types/csn';
import type { DatasphereObjectType } from '../../types/objectTypes';

export function resolveDependencies(
    csn: CsnFile,
    objectName: string,
    objectType: DatasphereObjectType,
): string[] {
    if (!objectType.preDeps) return [];
    return objectType.preDeps.resolve(csn, objectName);
}
