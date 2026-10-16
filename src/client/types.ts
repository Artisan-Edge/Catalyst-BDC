import type { BdcConfig } from '../types/config';
import type { CsnFile } from '../types/csn';
import type { AsyncResult } from '../types/result';
import type { DatasphereRequestOptions } from '../types/requestor';
import type { DatasphereObjectTypeName } from '../types/objectTypes';
import type { SearchObject, ListObjectsOptions, SearchOptions, SpaceFolder } from '../types/designObject';
import type { OAuthTokens } from '../core/auth/oauth';
import type { RunReplicationFlowResult } from '../core/operations/replication-flow/run';
import type { RunTransformationFlowResult } from '../core/operations/transformation-flow/run';
import type { ImportCsnResult } from '../core/operations/import/importCsn';
import type { SearchResult } from '../core/operations/navigator/searchObjects';
import type { DataPreviewOptions, DataPreviewResult } from '../core/operations/navigator/previewData';
import type { ViewColumn } from '../core/operations/navigator/getViewColumns';
import type {
    InaServerInfo, InaMetadataResult, InaQueryOptions, InaQueryResult,
    InaDataSource, InaVariable, InaModelEntry, InaModelDetails, InaSimpleQueryOptions,
} from '../ina/types';

export interface TokenCache {
    accessToken: string;
    refreshToken: string;
    expiresAfter: number;
    tokenUrl: string;
    clientId: string;
    clientSecret: string;
}

export interface CsrfCache {
    csrf: string;
    cookies: string;
}

export interface BdcClient {
    readonly config: BdcConfig;
    login(): AsyncResult<OAuthTokens>;
    logout(): AsyncResult<boolean>;

    // Read
    readAnalyticModel(objectName: string): AsyncResult<string>;
    readView(objectName: string): AsyncResult<string>;
    readLocalTable(objectName: string): AsyncResult<string>;
    readReplicationFlow(objectName: string): AsyncResult<string>;
    readTransformationFlow(objectName: string): AsyncResult<string>;

    // Delete
    deleteAnalyticModel(objectName: string): AsyncResult<string>;
    deleteView(objectName: string): AsyncResult<string>;
    deleteLocalTable(objectName: string): AsyncResult<string>;
    deleteReplicationFlow(objectName: string): AsyncResult<string>;
    deleteTransformationFlow(objectName: string): AsyncResult<string>;

    // Replication flow
    runReplicationFlow(flowName: string): AsyncResult<RunReplicationFlowResult>;

    // Transformation flow
    runTransformationFlow(flowName: string): AsyncResult<RunTransformationFlowResult>;

    // Import (multi-definition CSN via /deepsea/ API)
    importCsn(csn: CsnFile): AsyncResult<ImportCsnResult>;

    // Generic
    objectExists(objectType: DatasphereObjectTypeName, technicalName: string): AsyncResult<boolean>;

    // Navigator
    listObjects(options?: ListObjectsOptions): AsyncResult<SearchObject[]>;
    listFolders(parentFolderId?: string): AsyncResult<SpaceFolder[]>;
    searchObjects(options?: SearchOptions): AsyncResult<SearchResult>;

    // Data preview
    previewData(viewName: string, options?: DataPreviewOptions): AsyncResult<DataPreviewResult>;
    getViewColumns(viewName: string): AsyncResult<ViewColumn[]>;

    // [EXPERIMENTAL] INA protocol — low-level
    inaGetServerInfo(): AsyncResult<InaServerInfo>;
    inaGetMetadata(dataSource: InaDataSource, variables?: InaVariable[]): AsyncResult<InaMetadataResult>;
    inaQueryData(options: InaQueryOptions): AsyncResult<InaQueryResult>;

    // [EXPERIMENTAL] INA protocol — high-level
    inaListModels(options?: { pattern?: string }): AsyncResult<InaModelEntry[]>;
    inaExploreModel(modelName: string, variables?: InaVariable[]): AsyncResult<InaModelDetails>;
    inaQuery(options: InaSimpleQueryOptions): AsyncResult<InaQueryResult>;

    // Raw HTTP access (reuses auth + CSRF pipeline)
    rawRequest(options: DatasphereRequestOptions): AsyncResult<Response>;
}
