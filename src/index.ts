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
export type { ReplicationFlowResult } from './core/operations/upsertReplicationFlow';
export type { RunReplicationFlowResult } from './core/operations/runReplicationFlow';
export type { DeletableObjectType } from './core/operations/deleteObject';
