// Public API
export { createClient } from './client';
export type { BdcClient } from './client';

// Types
export type { BdcConfig, OAuthConfig, TokenConfig } from './types/config';
export type { CsnFile, CsnEntity, CsnElement, CsnReplicationFlow } from './types/csn';
export type {
    DesignObject, SearchObject, ListObjectsOptions, SearchOptions,
    DesignObjectKind, SpaceFolder, FolderHierarchyEntry,
} from './types/designObject';
export { DESIGN_OBJECT_KINDS } from './types/designObject';
export type { DatasphereObjectType, DatasphereObjectTypeName } from './types/objectTypes';
export { DATASPHERE_OBJECT_TYPES } from './types/objectTypes';
export type { DatasphereRequestor, DatasphereRequestOptions } from './types/requestor';
export type { Result, AsyncResult } from './types/result';
export { ok, err } from './types/result';

// Auth
export type { OAuthTokens } from './core/auth/oauth';

// HTTP helpers (for advanced usage / scripts)
export { refreshAccessToken, fetchCsrf } from './core/http/session';
export { checkResponse, buildDatasphereUrl } from './core/http/helpers';

// Import (multi-definition CSN via /deepsea/ API)
export { resolveSpaceId, importCsn, deployObjects, pollForObjectGuids } from './core/operations/import';
export type { ImportCsnResult } from './core/operations/import';

// Navigator
export { listObjects, listFolders, searchObjects } from './core/operations';
export type { SearchResult } from './core/operations/navigator';

// Data preview
export { previewData, getViewColumns } from './core/operations/navigator';
export type { DataPreviewOptions, DataPreviewResult } from './core/operations/navigator';
export type { ViewColumn } from './core/operations/navigator';

// Operation result types
export type { RunReplicationFlowResult } from './core/operations/replication-flow/run';

// [EXPERIMENTAL] INA protocol — low-level
export { getServerInfo as inaGetServerInfo, fetchInaCsrf, getMetadata as inaGetMetadata, queryData as inaQueryData } from './ina';
export type { InaCsrfToken } from './ina';
export type {
    InaServerInfo, InaMetadataResult, InaQueryOptions, InaQueryResult,
    InaDataSource, InaDimensionRequest, InaVariable, InaFilterSelection,
    InaDimensionInfo, InaAttributeInfo, InaCellRow,
    InaGrid, InaAxis, InaDimension, InaAttribute, InaCellsV2, InaMessage,
} from './ina';

// [EXPERIMENTAL] INA protocol — high-level
export { listModels as inaListModels, exploreModel as inaExploreModel, simpleQuery as inaSimpleQuery } from './ina';
export type { InaVariableInfo, InaModelEntry, InaModelDetails, InaSimpleQueryOptions } from './ina';
