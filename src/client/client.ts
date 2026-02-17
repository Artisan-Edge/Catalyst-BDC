import type { BdcConfig } from '../types/config';
import type { CsnFile } from '../types/csn';
import type { AsyncResult } from '../types/result';
import { ok, err } from '../types/result';
import type { DatasphereRequestor, DatasphereRequestOptions } from '../types/requestor';
import type { DatasphereObjectTypeName } from '../types/objectTypes';
import type { OAuthTokens } from '../core/auth/oauth';
import { loadCachedTokens, saveCachedTokens } from '../core/auth/tokenCache';
import type { UpsertLocalTableResult } from '../core/operations/local-table/upsert';
import type { UpsertReplicationFlowResult } from '../core/operations/replication-flow/upsert';
import type { RunReplicationFlowResult } from '../core/operations/replication-flow/run';
import type { UpsertViewResult } from '../core/operations/sql-view/upsert';
import { login as coreLogin } from '../core/operations/login';
import { createView as coreCreateView } from '../core/operations/sql-view/create';
import { readView as coreReadView } from '../core/operations/sql-view/read';
import { updateView as coreUpdateView } from '../core/operations/sql-view/update';
import { deleteView as coreDeleteView } from '../core/operations/sql-view/delete';
import { upsertView as coreUpsertView } from '../core/operations/sql-view/upsert';
import { createLocalTable as coreCreateLocalTable } from '../core/operations/local-table/create';
import { readLocalTable as coreReadLocalTable } from '../core/operations/local-table/read';
import { updateLocalTable as coreUpdateLocalTable } from '../core/operations/local-table/update';
import { deleteLocalTable as coreDeleteLocalTable } from '../core/operations/local-table/delete';
import { upsertLocalTable as coreUpsertLocalTable } from '../core/operations/local-table/upsert';
import { createReplicationFlow as coreCreateReplicationFlow } from '../core/operations/replication-flow/create';
import { readReplicationFlow as coreReadReplicationFlow } from '../core/operations/replication-flow/read';
import { updateReplicationFlow as coreUpdateReplicationFlow } from '../core/operations/replication-flow/update';
import { deleteReplicationFlow as coreDeleteReplicationFlow } from '../core/operations/replication-flow/delete';
import { upsertReplicationFlow as coreUpsertReplicationFlow } from '../core/operations/replication-flow/upsert';
import { runReplicationFlow as coreRunReplicationFlow } from '../core/operations/replication-flow/run';
import { objectExists as coreObjectExists } from '../core/operations/objectExists';
import { refreshAccessToken, fetchCsrf, TOKEN_EXPIRY_BUFFER_SEC } from '../core/http/session';
import { buildDatasphereUrl } from '../core/http/helpers';
import { debug } from '../core/utils/logging';

interface TokenCache {
    accessToken: string;
    refreshToken: string;
    expiresAfter: number;
    tokenUrl: string;
    clientId: string;
    clientSecret: string;
}

interface CsrfCache {
    csrf: string;
    cookies: string;
}

export interface BdcClient {
    readonly config: BdcConfig;
    login(): AsyncResult<OAuthTokens>;

    // SQL view
    createView(csn: CsnFile, objectName: string): AsyncResult<string>;
    readView(objectName: string): AsyncResult<string>;
    updateView(csn: CsnFile, objectName: string): AsyncResult<string>;
    deleteView(objectName: string): AsyncResult<string>;
    upsertView(csn: CsnFile, objectName: string): AsyncResult<UpsertViewResult>;

    // Local table
    createLocalTable(csn: CsnFile, objectName: string): AsyncResult<string>;
    readLocalTable(objectName: string): AsyncResult<string>;
    updateLocalTable(csn: CsnFile, objectName: string): AsyncResult<string>;
    deleteLocalTable(objectName: string): AsyncResult<string>;
    upsertLocalTable(csn: CsnFile, objectName: string): AsyncResult<UpsertLocalTableResult>;

    // Replication flow
    createReplicationFlow(csn: CsnFile, objectName: string): AsyncResult<string>;
    readReplicationFlow(objectName: string): AsyncResult<string>;
    updateReplicationFlow(csn: CsnFile, objectName: string): AsyncResult<string>;
    deleteReplicationFlow(objectName: string): AsyncResult<string>;
    upsertReplicationFlow(csn: CsnFile, objectName: string): AsyncResult<UpsertReplicationFlowResult>;
    runReplicationFlow(flowName: string): AsyncResult<RunReplicationFlowResult>;

    // Generic
    objectExists(objectType: DatasphereObjectTypeName, technicalName: string): AsyncResult<boolean>;
}

export class BdcClientImpl implements BdcClient {
    readonly config: BdcConfig;
    private tokenCache: TokenCache | null = null;
    private csrfCache: CsrfCache | null = null;
    private requestor: DatasphereRequestor;

    constructor(config: BdcConfig) {
        this.config = config;
        this.requestor = { request: this.request.bind(this) };

        // Seed from pre-provided tokens
        if (config.tokens) {
            this.tokenCache = {
                accessToken: config.tokens.accessToken,
                refreshToken: config.tokens.refreshToken,
                expiresAfter: config.tokens.expiresAfter ?? 0,
                tokenUrl: config.tokens.tokenUrl,
                clientId: config.tokens.clientId,
                clientSecret: config.tokens.clientSecret,
            };
        }
    }

    private async ensureAccessToken(): AsyncResult<string> {
        if (!this.tokenCache) {
            return err(new Error('Not authenticated — call login() first or provide tokens in config'));
        }

        const nowSec = Math.floor(Date.now() / 1000);
        if (this.tokenCache.expiresAfter > nowSec + TOKEN_EXPIRY_BUFFER_SEC) {
            return ok(this.tokenCache.accessToken);
        }

        // Token expired — refresh
        debug('Access token expired, refreshing...');
        const [refreshed, refreshErr] = await refreshAccessToken(
            this.tokenCache.tokenUrl,
            this.tokenCache.refreshToken,
            this.tokenCache.clientId,
            this.tokenCache.clientSecret,
        );
        if (refreshErr) return err(refreshErr);

        this.tokenCache.accessToken = refreshed.accessToken;
        this.tokenCache.expiresAfter = refreshed.expiresAfter;

        // Persist refreshed tokens
        saveCachedTokens(this.config.host, this.tokenCache as OAuthTokens);

        // Invalidate CSRF since access token changed
        this.csrfCache = null;

        return ok(refreshed.accessToken);
    }

    private async ensureCsrf(accessToken: string): AsyncResult<CsrfCache> {
        if (this.csrfCache) return ok(this.csrfCache);

        const [csrfResult, csrfErr] = await fetchCsrf(this.config.host, accessToken);
        if (csrfErr) return err(csrfErr);

        this.csrfCache = csrfResult;
        return ok(this.csrfCache);
    }

    private async request(options: DatasphereRequestOptions): AsyncResult<Response, Error> {
        const [accessToken, tokenErr] = await this.ensureAccessToken();
        if (tokenErr) return err(tokenErr);

        // Mutations need CSRF
        const isMutation = options.method !== 'GET' && options.method !== 'HEAD';

        let csrf: CsrfCache | null = null;
        if (isMutation) {
            const [csrfResult, csrfErr] = await this.ensureCsrf(accessToken);
            if (csrfErr) return err(csrfErr);
            csrf = csrfResult;
        }

        const url = buildDatasphereUrl(this.config.host, options.path, options.params);
        debug(options.method, url);

        const headers: Record<string, string> = {
            'Authorization': `Bearer ${accessToken}`,
            'X-Requested-With': 'XMLHttpRequest',
            ...options.headers,
        };

        // Datasphere API requires explicit Accept header for GET requests
        if (!isMutation && !headers['Accept']) {
            headers['Accept'] = 'application/vnd.sap.datasphere.object.content+json';
        }

        if (csrf) {
            headers['X-Csrf-Token'] = csrf.csrf;
            headers['Cookie'] = csrf.cookies;
        }

        const response = await fetch(url, {
            method: options.method,
            headers,
            body: options.body,
        });

        // CSRF retry on 403
        if (response.status === 403 && isMutation) {
            debug('Got 403, retrying with fresh CSRF token...');
            this.csrfCache = null;

            const [freshCsrf, freshCsrfErr] = await this.ensureCsrf(accessToken);
            if (freshCsrfErr) return err(freshCsrfErr);

            headers['X-Csrf-Token'] = freshCsrf.csrf;
            headers['Cookie'] = freshCsrf.cookies;

            const retryResponse = await fetch(url, {
                method: options.method,
                headers,
                body: options.body,
            });

            return ok(retryResponse);
        }

        return ok(response);
    }

    async login(): AsyncResult<OAuthTokens> {
        // Try cached tokens first
        const [cached] = loadCachedTokens(this.config.host);
        if (cached) {
            const nowSec = Math.floor(Date.now() / 1000);

            if (cached.expiresAfter > nowSec + TOKEN_EXPIRY_BUFFER_SEC) {
                debug('Using cached tokens (still valid)');
                this.tokenCache = cached;

                const [csrfResult, csrfErr] = await fetchCsrf(this.config.host, cached.accessToken);
                if (!csrfErr) {
                    this.csrfCache = csrfResult;
                    return ok(cached);
                }
                debug('Cached token CSRF failed, will try refresh');
            }

            // Token expired but we have refresh token — try refresh
            debug('Cached access token expired, refreshing...');
            const [refreshed, refreshErr] = await refreshAccessToken(
                cached.tokenUrl, cached.refreshToken, cached.clientId, cached.clientSecret,
            );
            if (!refreshErr) {
                const tokens: OAuthTokens = {
                    ...cached,
                    accessToken: refreshed.accessToken,
                    expiresAfter: refreshed.expiresAfter,
                };
                this.tokenCache = tokens;
                saveCachedTokens(this.config.host, tokens);

                const [csrfResult, csrfErr] = await fetchCsrf(this.config.host, tokens.accessToken);
                if (!csrfErr) {
                    this.csrfCache = csrfResult;
                    return ok(tokens);
                }
                debug('Refreshed token CSRF failed, will do full login');
            } else {
                debug('Token refresh failed:', refreshErr.message);
            }
        }

        // Full browser login
        const [tokens, loginErr] = await coreLogin(this.config);
        if (loginErr) return err(loginErr);

        this.tokenCache = {
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresAfter: tokens.expiresAfter,
            tokenUrl: tokens.tokenUrl,
            clientId: tokens.clientId,
            clientSecret: tokens.clientSecret,
        };

        saveCachedTokens(this.config.host, tokens);

        // Fetch initial CSRF
        const [csrfResult, csrfErr] = await fetchCsrf(this.config.host, tokens.accessToken);
        if (csrfErr) return err(csrfErr);
        this.csrfCache = csrfResult;

        return ok(tokens);
    }

    // SQL view
    async createView(csn: CsnFile, objectName: string): AsyncResult<string> {
        return coreCreateView(this.requestor, this.config.space, csn, objectName);
    }

    async readView(objectName: string): AsyncResult<string> {
        return coreReadView(this.requestor, this.config.space, objectName);
    }

    async updateView(csn: CsnFile, objectName: string): AsyncResult<string> {
        return coreUpdateView(this.requestor, this.config.space, csn, objectName);
    }

    async deleteView(objectName: string): AsyncResult<string> {
        return coreDeleteView(this.requestor, this.config.space, objectName);
    }

    async upsertView(csn: CsnFile, objectName: string): AsyncResult<UpsertViewResult> {
        return coreUpsertView(this.requestor, this.config.space, csn, objectName);
    }

    // Local table
    async createLocalTable(csn: CsnFile, objectName: string): AsyncResult<string> {
        return coreCreateLocalTable(this.requestor, this.config.space, csn, objectName);
    }

    async readLocalTable(objectName: string): AsyncResult<string> {
        return coreReadLocalTable(this.requestor, this.config.space, objectName);
    }

    async updateLocalTable(csn: CsnFile, objectName: string): AsyncResult<string> {
        return coreUpdateLocalTable(this.requestor, this.config.space, csn, objectName);
    }

    async deleteLocalTable(objectName: string): AsyncResult<string> {
        return coreDeleteLocalTable(this.requestor, this.config.space, objectName);
    }

    async upsertLocalTable(csn: CsnFile, objectName: string): AsyncResult<UpsertLocalTableResult> {
        return coreUpsertLocalTable(this.requestor, this.config.space, csn, objectName);
    }

    // Replication flow
    async createReplicationFlow(csn: CsnFile, objectName: string): AsyncResult<string> {
        return coreCreateReplicationFlow(this.requestor, this.config.space, csn, objectName);
    }

    async readReplicationFlow(objectName: string): AsyncResult<string> {
        return coreReadReplicationFlow(this.requestor, this.config.space, objectName);
    }

    async updateReplicationFlow(csn: CsnFile, objectName: string): AsyncResult<string> {
        return coreUpdateReplicationFlow(this.requestor, this.config.space, csn, objectName);
    }

    async deleteReplicationFlow(objectName: string): AsyncResult<string> {
        return coreDeleteReplicationFlow(this.requestor, this.config.space, objectName);
    }

    async upsertReplicationFlow(csn: CsnFile, objectName: string): AsyncResult<UpsertReplicationFlowResult> {
        return coreUpsertReplicationFlow(this.requestor, this.config.space, csn, objectName);
    }

    async runReplicationFlow(flowName: string): AsyncResult<RunReplicationFlowResult> {
        return coreRunReplicationFlow(this.requestor, this.config.space, flowName);
    }

    // Generic
    async objectExists(objectType: DatasphereObjectTypeName, technicalName: string): AsyncResult<boolean> {
        return coreObjectExists(this.requestor, this.config.space, objectType, technicalName);
    }
}
