import type { CsnFile } from '../types/csn';
import type { AsyncResult } from '../types/result';
import type { DatasphereRequestOptions } from '../types/requestor';
import type { DatasphereObjectTypeName } from '../types/objectTypes';
import type { OAuthTokens } from '../core/auth/oauth';
import type { UpsertLocalTableResult } from '../core/operations/local-table/upsert';
import type { UpsertReplicationFlowResult } from '../core/operations/replication-flow/upsert';
import type { RunReplicationFlowResult } from '../core/operations/replication-flow/run';
import type { UpsertViewResult } from '../core/operations/sql-view/upsert';

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
    readonly config: import('../types/config').BdcConfig;
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

    // Raw HTTP access (reuses auth + CSRF pipeline)
    rawRequest(options: DatasphereRequestOptions): AsyncResult<Response>;
}
