import type { BdcConfig } from '../types/config';
import type { Result } from '../types/result';
import { ok, err } from '../types/result';
import { bdcConfigSchema } from '../types/config';
import { activateLogging } from '../core/utils/logging';
import { BdcClientImpl } from './client';
import type { BdcClient } from './client';

export type { BdcClient };

export function createClient(config: BdcConfig): Result<BdcClient, Error> {
    const validation = bdcConfigSchema.safeParse(config);
    if (!validation.success) {
        const issues = validation.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ');
        return err(new Error(`Invalid BDC configuration: ${issues}`));
    }

    if (config.verbose) activateLogging();

    return ok(new BdcClientImpl(config));
}
