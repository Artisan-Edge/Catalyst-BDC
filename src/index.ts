// Public API
export { createClient } from './client';
export type { BdcClient } from './client';

// Types
export type { BdcConfig, OAuthConfig, TokenConfig } from './types/config';
export type { CsnFile, CsnEntity, CsnElement, CsnReplicationFlow } from './types/csn';
export type { DatasphereObjectType, DatasphereObjectTypeName } from './types/objectTypes';
export { DATASPHERE_OBJECT_TYPES } from './types/objectTypes';
export type { DatasphereRequestor, DatasphereRequestOptions } from './types/requestor';
export type { Result, AsyncResult } from './types/result';
export { ok, err } from './types/result';

// Auth
export type { OAuthTokens } from './core/auth/oauth';

// HTTP helpers (for advanced usage / scripts)
export { refreshAccessToken } from './core/http/refreshAccessToken';
export { fetchCsrf } from './core/http/fetchCsrf';
export { checkResponse } from './core/http/checkResponse';
export { buildDatasphereUrl } from './core/http/buildDatasphereUrl';

// Operation result types
export type { UpsertLocalTableResult } from './core/operations/local-table/upsert';
export type { UpsertReplicationFlowResult } from './core/operations/replication-flow/upsert';
export type { RunReplicationFlowResult } from './core/operations/replication-flow/run';
export type { UpsertViewResult } from './core/operations/sql-view/upsert';
