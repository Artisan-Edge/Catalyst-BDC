import type { BdcConfig } from '../../types/config';
import type { AsyncResult } from '../../types/result';
import { ok, err } from '../../types/result';
import { performOAuthLogin } from '../auth/oauth';
import type { OAuthTokens } from '../auth/oauth';
import { debug } from '../utils/logging';

export async function login(config: BdcConfig): AsyncResult<OAuthTokens> {
    if (!config.oauth) {
        return err(new Error('Cannot perform OAuth login without oauth config'));
    }

    debug('Starting OAuth login...');

    const [tokens, loginErr] = await performOAuthLogin(config.oauth);
    if (loginErr) return err(loginErr);

    debug('Login successful');
    return ok(tokens);
}
