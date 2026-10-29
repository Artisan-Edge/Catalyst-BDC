import type { BdcConfig } from '../types/config';
import type { CsnFile } from '../types/csn';
import type { AsyncResult } from '../types/result';
import { ok, err } from '../types/result';
import type { DatasphereRequestor, DatasphereRequestOptions } from '../types/requestor';
import type { DatasphereObjectTypeName } from '../types/objectTypes';
import type { SearchObject, ListObjectsOptions, SearchOptions, SpaceFolder } from '../types/designObject';
import type { DataPreviewOptions, DataPreviewResult } from '../core/operations/navigator/previewData';
import type { ViewColumn } from '../core/operations/navigator/getViewColumns';
import type { OAuthTokens } from '../core/auth/oauth';
import { deleteCachedTokens } from '../core/auth/tokenCache';
import type { RunReplicationFlowResult } from '../core/operations/replication-flow/run';
import type { RunTransformationFlowResult } from '../core/operations/transformation-flow/run';
import type { ImportCsnResult } from '../core/operations/import/importCsn';
import type { SearchResult } from '../core/operations/navigator/searchObjects';
import { getServerInfo as coreInaGetServerInfo } from '../ina/getServerInfo';
import { fetchInaCsrf as coreFetchInaCsrf } from '../ina/fetchInaCsrf';
import { getMetadata as coreInaGetMetadata } from '../ina/getMetadata';
import { queryData as coreInaQueryData } from '../ina/queryData';
import { listModels as coreInaListModels } from '../ina/listModels';
import { exploreModel as coreInaExploreModel } from '../ina/exploreModel';
import { simpleQuery as coreInaSimpleQuery } from '../ina/simpleQuery';
import type { InaCsrfToken } from '../ina/fetchInaCsrf';
import type {
    InaServerInfo, InaMetadataResult, InaQueryOptions, InaQueryResult,
    InaDataSource, InaVariable, InaModelEntry, InaModelDetails, InaSimpleQueryOptions,
} from '../ina/types';
import { readAnalyticModel as coreReadAnalyticModel } from '../core/operations/analytic-model/read';
import { deleteAnalyticModel as coreDeleteAnalyticModel } from '../core/operations/analytic-model/delete';
import { readView as coreReadView } from '../core/operations/sql-view/read';
import { deleteView as coreDeleteView } from '../core/operations/sql-view/delete';
import { readLocalTable as coreReadLocalTable } from '../core/operations/local-table/read';
import { deleteLocalTable as coreDeleteLocalTable } from '../core/operations/local-table/delete';
import { readReplicationFlow as coreReadReplicationFlow } from '../core/operations/replication-flow/read';
import { deleteReplicationFlow as coreDeleteReplicationFlow } from '../core/operations/replication-flow/delete';
import { runReplicationFlow as coreRunReplicationFlow } from '../core/operations/replication-flow/run';
import { readTransformationFlow as coreReadTransformationFlow } from '../core/operations/transformation-flow/read';
import { deleteTransformationFlow as coreDeleteTransformationFlow } from '../core/operations/transformation-flow/delete';
import { runTransformationFlow as coreRunTransformationFlow } from '../core/operations/transformation-flow/run';
import { objectExists as coreObjectExists } from '../core/operations/objectExists';
import { listObjects as coreListObjects } from '../core/operations/navigator/listObjects';
import { listFolders as coreListFolders } from '../core/operations/navigator/listFolders';
import { searchObjects as coreSearchObjects } from '../core/operations/navigator/searchObjects';
import { previewData as corePreviewData } from '../core/operations/navigator/previewData';
import { getViewColumns as coreGetViewColumns } from '../core/operations/navigator/getViewColumns';
import { resolveSpaceId as coreResolveSpaceId } from '../core/operations/import/resolveSpaceId';
import { importCsn as coreImportCsn } from '../core/operations/import/importCsn';
import { deployObjects as coreDeployObjects } from '../core/operations/import/deployObjects';
import { pollForObjectGuids as corePollForObjectGuids } from '../core/operations/import/pollForObjectGuids';
import { fetchCsrf } from '../core/http/fetchCsrf';
import { debug } from '../core/utils/logging';
import type { BdcClient, TokenCache, CsrfCache } from './types';
import { executeRequest, type RequestAuth } from './request';
import { clientLogin } from './login';
import { ensureAccessToken } from './ensureAccessToken';
import { singleFlight } from './singleFlight';

export class BdcClientImpl implements BdcClient {
    readonly config: BdcConfig;
    private tokenCache: TokenCache | null = null;
    private csrfCache: CsrfCache | null = null;
    private spaceId: string | null = null;
    private inaCsrf: InaCsrfToken | null = null;
    private requestor: DatasphereRequestor;
    private auth: RequestAuth;

    // Concurrent callers share one in-flight fetch: near expiry, N parallel requests would
    // otherwise each refresh the token and rewrite the shared token file
    private readonly sharedAccessToken = singleFlight(() => this.loadAccessToken());
    private readonly sharedCsrf = singleFlight((accessToken: string) => this.loadCsrf(accessToken));
    private readonly sharedSpaceId = singleFlight(() => this.loadSpaceId());
    private readonly sharedInaCsrf = singleFlight(() => this.loadInaCsrf());

    constructor(config: BdcConfig) {
        this.config = config;
        this.requestor = { request: this.request.bind(this) };
        this.auth = {
            accessToken: () => this.sharedAccessToken(),
            csrf: accessToken => this.csrfCache ? Promise.resolve(ok(this.csrfCache)) : this.sharedCsrf(accessToken),
            invalidateCsrf: stale => {
                if (this.csrfCache === stale) this.csrfCache = null;
            },
        };

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

    private request(options: DatasphereRequestOptions): AsyncResult<Response, Error> {
        return executeRequest(this.config.host, this.auth, options);
    }

    private async loadAccessToken(): AsyncResult<string> {
        const [result, error] = await ensureAccessToken(this.tokenCache, this.config.host);
        if (error) return err(error);

        this.tokenCache = result.tokenCache;
        if (result.csrfInvalidated) this.csrfCache = null;
        return ok(result.accessToken);
    }

    private async loadCsrf(accessToken: string): AsyncResult<CsrfCache> {
        const [csrf, error] = await fetchCsrf(this.config.host, accessToken);
        if (error) return err(error);

        // A token refresh while this was in flight makes it a CSRF for the old access token; hand it to
        // the callers waiting on it (a 403 will retry them) but don't cache it for everyone else
        if (this.tokenCache?.accessToken === accessToken) this.csrfCache = csrf;
        return ok(csrf);
    }

    private async loadSpaceId(): AsyncResult<string> {
        if (this.spaceId) return ok(this.spaceId);

        const [spaceId, error] = await coreResolveSpaceId(this.requestor, this.config.space);
        if (error) return err(error);

        this.spaceId = spaceId;
        return ok(spaceId);
    }

    async login(): AsyncResult<OAuthTokens> {
        const [result, loginErr] = await clientLogin(this.config, this.tokenCache);
        if (loginErr) return err(loginErr);

        this.tokenCache = result.tokenCache;
        this.csrfCache = result.csrfCache;
        return ok(result.tokens);
    }

    // Clears in-memory auth state and removes this host's entry from the
    // token cache file. Returns whether cached tokens existed.
    async logout(): AsyncResult<boolean> {
        this.tokenCache = null;
        this.csrfCache = null;
        this.inaCsrf = null;

        const existed = await deleteCachedTokens(this.config.host);
        return ok(existed);
    }

    // Read
    readAnalyticModel(objectName: string): AsyncResult<string> {
        return coreReadAnalyticModel(this.requestor, this.config.space, objectName);
    }

    readView(objectName: string): AsyncResult<string> {
        return coreReadView(this.requestor, this.config.space, objectName);
    }

    readLocalTable(objectName: string): AsyncResult<string> {
        return coreReadLocalTable(this.requestor, this.config.space, objectName);
    }

    readReplicationFlow(objectName: string): AsyncResult<string> {
        return coreReadReplicationFlow(this.requestor, this.config.space, objectName);
    }

    readTransformationFlow(objectName: string): AsyncResult<string> {
        return coreReadTransformationFlow(this.requestor, this.config.space, objectName);
    }

    // Delete
    deleteAnalyticModel(objectName: string): AsyncResult<string> {
        return coreDeleteAnalyticModel(this.requestor, this.config.space, objectName);
    }

    deleteView(objectName: string): AsyncResult<string> {
        return coreDeleteView(this.requestor, this.config.space, objectName);
    }

    deleteLocalTable(objectName: string): AsyncResult<string> {
        return coreDeleteLocalTable(this.requestor, this.config.space, objectName);
    }

    deleteReplicationFlow(objectName: string): AsyncResult<string> {
        return coreDeleteReplicationFlow(this.requestor, this.config.space, objectName);
    }

    deleteTransformationFlow(objectName: string): AsyncResult<string> {
        return coreDeleteTransformationFlow(this.requestor, this.config.space, objectName);
    }

    // Replication flow
    runReplicationFlow(flowName: string): AsyncResult<RunReplicationFlowResult> {
        return coreRunReplicationFlow(this.requestor, this.config.space, flowName);
    }

    // Transformation flow
    runTransformationFlow(flowName: string): AsyncResult<RunTransformationFlowResult> {
        return coreRunTransformationFlow(this.requestor, this.config.space, flowName);
    }

    // Import
    async importCsn(csn: CsnFile): AsyncResult<ImportCsnResult> {
        const [spaceId, spaceIdErr] = await this.sharedSpaceId();
        if (spaceIdErr) return err(spaceIdErr);

        const [importResult, importErr] = await coreImportCsn(this.requestor, this.config.space, spaceId, csn);
        if (importErr) return err(importErr);

        let objectIds = importResult.objectIds;

        // Async import — Datasphere processes large payloads in the background
        // and returns no object IDs. Poll designObjects until they appear.
        const allObjectNames = [
            ...Object.keys(csn.definitions ?? {}),
            ...Object.keys(csn.businessLayerDefinitions ?? {}),
            ...Object.keys(csn.replicationflows ?? {}),
            ...Object.keys(csn.transformationflows ?? {}),
        ];

        if (objectIds.length === 0 && allObjectNames.length > 0) {
            debug('Import returned no object IDs (async background save). Polling for completion...');

            const [pollResult, pollErr] = await corePollForObjectGuids(this.requestor, this.config.space, allObjectNames);
            if (pollErr) return err(pollErr);

            objectIds = pollResult.objectIds;
        }

        // Deploy imported objects
        if (objectIds.length > 0) {
            const [, deployErr] = await coreDeployObjects(this.requestor, this.config.space, spaceId, objectIds);
            if (deployErr) return err(deployErr);
        }

        return ok({ ...importResult, objectIds });
    }

    // Generic
    objectExists(objectType: DatasphereObjectTypeName, technicalName: string): AsyncResult<boolean> {
        return coreObjectExists(this.requestor, this.config.space, objectType, technicalName);
    }

    // Navigator
    listObjects(options?: ListObjectsOptions): AsyncResult<SearchObject[]> {
        return coreListObjects(this.requestor, this.config.space, options);
    }

    listFolders(parentFolderId?: string): AsyncResult<SpaceFolder[]> {
        return coreListFolders(this.requestor, this.config.space, parentFolderId);
    }

    searchObjects(options?: SearchOptions): AsyncResult<SearchResult> {
        return coreSearchObjects(this.requestor, this.config.space, options);
    }

    // Data preview
    previewData(viewName: string, options?: DataPreviewOptions): AsyncResult<DataPreviewResult> {
        return corePreviewData(this.requestor, this.config.space, viewName, options);
    }

    getViewColumns(viewName: string): AsyncResult<ViewColumn[]> {
        return coreGetViewColumns(this.requestor, this.config.space, viewName);
    }

    // [EXPERIMENTAL] INA protocol
    private ensureInaCsrf(): AsyncResult<InaCsrfToken> {
        if (this.inaCsrf) return Promise.resolve(ok(this.inaCsrf));
        return this.sharedInaCsrf();
    }

    private async loadInaCsrf(): AsyncResult<InaCsrfToken> {
        const [accessToken, tokenErr] = await this.sharedAccessToken();
        if (tokenErr) return err(tokenErr);

        const [csrf, csrfErr] = await coreFetchInaCsrf(this.config.host, accessToken);
        if (csrfErr) return err(csrfErr);

        this.inaCsrf = csrf;
        return ok(csrf);
    }

    inaGetServerInfo(): AsyncResult<InaServerInfo> {
        return coreInaGetServerInfo(this.requestor);
    }

    async inaGetMetadata(dataSource: InaDataSource, variables?: InaVariable[]): AsyncResult<InaMetadataResult> {
        const [csrf, csrfErr] = await this.ensureInaCsrf();
        if (csrfErr) return err(csrfErr);
        return coreInaGetMetadata(this.requestor, csrf, dataSource, variables);
    }

    async inaQueryData(options: InaQueryOptions): AsyncResult<InaQueryResult> {
        const [csrf, csrfErr] = await this.ensureInaCsrf();
        if (csrfErr) return err(csrfErr);
        return coreInaQueryData(this.requestor, csrf, options);
    }

    // INA high-level
    inaListModels(options?: { pattern?: string }): AsyncResult<InaModelEntry[]> {
        return coreInaListModels(this.requestor, this.config.space, options);
    }

    async inaExploreModel(modelName: string, variables?: InaVariable[]): AsyncResult<InaModelDetails> {
        const [csrf, csrfErr] = await this.ensureInaCsrf();
        if (csrfErr) return err(csrfErr);
        return coreInaExploreModel(this.requestor, csrf, this.config.space, modelName, variables);
    }

    async inaQuery(options: InaSimpleQueryOptions): AsyncResult<InaQueryResult> {
        const [csrf, csrfErr] = await this.ensureInaCsrf();
        if (csrfErr) return err(csrfErr);
        return coreInaSimpleQuery(this.requestor, csrf, this.config.space, options);
    }

    rawRequest(options: DatasphereRequestOptions): AsyncResult<Response> {
        return this.request(options);
    }
}
