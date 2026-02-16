// Public API
export { createClient } from './client';
export type { BdcClient } from './client';

// Types
export type { BdcConfig, OAuthConfig } from './types/config';
export type { CsnFile, CsnEntity, CsnElement, CsnReplicationFlow } from './types/csn';
export type { DspObjectType, DspObjectTypeName } from './types/objectTypes';
export { DSP_OBJECT_TYPES } from './types/objectTypes';
export type { Result, AsyncResult } from './types/result';
export { ok, err } from './types/result';

// Operation result types
export type { UpsertLocalTableResult } from './core/operations/local-table/upsert';
export type { UpsertReplicationFlowResult } from './core/operations/replication-flow/upsert';
export type { RunReplicationFlowResult } from './core/operations/replication-flow/run';
export type { UpsertViewResult } from './core/operations/sql-view/upsert';
