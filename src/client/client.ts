import type { BdcConfig } from '../types/config';
import type { CsnFile } from '../types/csn';
import type { AsyncResult } from '../types/result';
import { ok, err } from '../types/result';
import type { DatasphereRequestor, DatasphereRequestOptions } from '../types/requestor';
import type { DatasphereObjectTypeName } from '../types/objectTypes';
import type { SearchObject, ListObjectsOptions, SearchOptions, SpaceFolder } from '../types/designObject';
import type { OAuthTokens } from '../core/auth/oauth';
import { loadCachedTokens, saveCachedTokens } from '../core/auth/tokenCache';
import type { RunReplicationFlowResult } from '../core/operations/replication-flow/run';
import type { ImportCsnResult } from '../core/operations/import/importCsn';
import type { SearchResult } from '../core/operations/searchObjects';
import { login as coreLogin } from '../core/operations/login';
import { readAnalyticModel as coreReadAnalyticModel } from '../core/operations/analytic-model/read';
import { deleteAnalyticModel as coreDeleteAnalyticModel } from '../core/operations/analytic-model/delete';
import { readView as coreReadView } from '../core/operations/sql-view/read';
import { deleteView as coreDeleteView } from '../core/operations/sql-view/delete';
import { readLocalTable as coreReadLocalTable } from '../core/operations/local-table/read';
import { deleteLocalTable as coreDeleteLocalTable } from '../core/operations/local-table/delete';
import { readReplicationFlow as coreReadReplicationFlow } from '../core/operations/replication-flow/read';
import { deleteReplicationFlow as coreDeleteReplicationFlow } from '../core/operations/replication-flow/delete';
import { runReplicationFlow as coreRunReplicationFlow } from '../core/operations/replication-flow/run';
import { objectExists as coreObjectExists } from '../core/operations/objectExists';
import { listObjects as coreListObjects } from '../core/operations/listObjects';
import { listFolders as coreListFolders } from '../core/operations/listFolders';
import { searchObjects as coreSearchObjects } from '../core/operations/searchObjects';
import { resolveSpaceId as coreResolveSpaceId } from '../core/operations/import/resolveSpaceId';
import { importCsn as coreImportCsn } from '../core/operations/import/importCsn';
import { deployObjects as coreDeployObjects } from '../core/operations/import/deployObjects';
import { pollForObjectGuids as corePollForObjectGuids } from '../core/operations/import/pollForObjectGuids';
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

    // Read
    readAnalyticModel(objectName: string): AsyncResult<string>;
    readView(objectName: string): AsyncResult<string>;
    readLocalTable(objectName: string): AsyncResult<string>;
    readReplicationFlow(objectName: string): AsyncResult<string>;

    // Delete
    deleteAnalyticModel(objectName: string): AsyncResult<string>;
    deleteView(objectName: string): AsyncResult<string>;
    deleteLocalTable(objectName: string): AsyncResult<string>;
    deleteReplicationFlow(objectName: string): AsyncResult<string>;

    // Replication flow
    runReplicationFlow(flowName: string): AsyncResult<RunReplicationFlowResult>;

    // Import (multi-definition CSN via /deepsea/ API)
    importCsn(csn: CsnFile): AsyncResult<ImportCsnResult>;

    // Generic
    objectExists(objectType: DatasphereObjectTypeName, technicalName: string): AsyncResult<boolean>;

    // Navigator
    listObjects(options?: ListObjectsOptions): AsyncResult<SearchObject[]>;
    listFolders(parentFolderId?: string): AsyncResult<SpaceFolder[]>;
    searchObjects(options?: SearchOptions): AsyncResult<SearchResult>;
}

export class BdcClientImpl implements BdcClient {
    readonly config: BdcConfig;
    private tokenCache: TokenCache | null = null;
    private csrfCache: CsrfCache | null = null;
    private spaceId: string | null = null;
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

    // Read
    async readAnalyticModel(objectName: string): AsyncResult<string> {
        return coreReadAnalyticModel(this.requestor, this.config.space, objectName);
    }

    async readView(objectName: string): AsyncResult<string> {
        return coreReadView(this.requestor, this.config.space, objectName);
    }

    async readLocalTable(objectName: string): AsyncResult<string> {
        return coreReadLocalTable(this.requestor, this.config.space, objectName);
    }

    async readReplicationFlow(objectName: string): AsyncResult<string> {
        return coreReadReplicationFlow(this.requestor, this.config.space, objectName);
    }

    // Delete
    async deleteAnalyticModel(objectName: string): AsyncResult<string> {
        return coreDeleteAnalyticModel(this.requestor, this.config.space, objectName);
    }

    async deleteView(objectName: string): AsyncResult<string> {
        return coreDeleteView(this.requestor, this.config.space, objectName);
    }

    async deleteLocalTable(objectName: string): AsyncResult<string> {
        return coreDeleteLocalTable(this.requestor, this.config.space, objectName);
    }

    async deleteReplicationFlow(objectName: string): AsyncResult<string> {
        return coreDeleteReplicationFlow(this.requestor, this.config.space, objectName);
    }

    // Replication flow
    async runReplicationFlow(flowName: string): AsyncResult<RunReplicationFlowResult> {
        return coreRunReplicationFlow(this.requestor, this.config.space, flowName);
    }

    // Import
    async importCsn(csn: CsnFile): AsyncResult<ImportCsnResult> {
        if (!this.spaceId) {
            const [resolved, resolveErr] = await coreResolveSpaceId(this.requestor, this.config.space);
            if (resolveErr) return err(resolveErr);
            this.spaceId = resolved;
        }

        const [importResult, importErr] = await coreImportCsn(this.requestor, this.config.space, this.spaceId, csn);
        if (importErr) return err(importErr);

        let objectIds = importResult.objectIds;

        // Async import — Datasphere processes large payloads in the background
        // and returns no object IDs. Poll designObjects until they appear.
        if (objectIds.length === 0 && Object.keys(csn.definitions ?? {}).length > 0) {
            debug('Import returned no object IDs (async background save). Polling for completion...');

            const definitionNames = Object.keys(csn.definitions ?? {});
            const [pollResult, pollErr] = await corePollForObjectGuids(this.requestor, this.config.space, definitionNames);
            if (pollErr) return err(pollErr);

            objectIds = pollResult.objectIds;
            importResult.objectIds = objectIds;
        }

        // Deploy imported objects
        if (objectIds.length > 0) {
            const [, deployErr] = await coreDeployObjects(this.requestor, this.config.space, this.spaceId, objectIds);
            if (deployErr) return err(deployErr);
        }

        return ok(importResult);
    }

    // Generic
    async objectExists(objectType: DatasphereObjectTypeName, technicalName: string): AsyncResult<boolean> {
        return coreObjectExists(this.requestor, this.config.space, objectType, technicalName);
    }

    // Navigator
    async listObjects(options?: ListObjectsOptions): AsyncResult<SearchObject[]> {
        return coreListObjects(this.requestor, this.config.space, options);
    }

    async listFolders(parentFolderId?: string): AsyncResult<SpaceFolder[]> {
        return coreListFolders(this.requestor, this.config.space, parentFolderId);
    }

    async searchObjects(options?: SearchOptions): AsyncResult<SearchResult> {
        return coreSearchObjects(this.requestor, this.config.space, options);
    }
}
