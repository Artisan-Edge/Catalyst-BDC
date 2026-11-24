import type { ObjectWriteOptions } from '../../types/operationOptions';

// The query of a design-time save, every parameter explicit as SAP's datasphere CLI sends them (it sends an
// unset boolean as false and deploy as its default, true)
export function writeParams(options: ObjectWriteOptions = {}): Record<string, string> {
    return {
        saveAnyway: String(options.saveAnyway ?? false),
        allowMissingDependencies: String(options.allowMissingDependencies ?? false),
        deploy: String(options.deploy ?? true),
    };
}
