import type { CsnFile } from '../../types/csn';
import type { DspObjectType } from '../../types/objectTypes';

export function resolveDependencies(
    csn: CsnFile,
    objectName: string,
    objectType: DspObjectType,
): string[] {
    if (!objectType.preDeps) return [];
    return objectType.preDeps.resolve(csn, objectName);
}
