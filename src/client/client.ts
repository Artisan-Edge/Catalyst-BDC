import type { BdcConfig } from '../types/config';
import type { CsnFile } from '../types/csn';
import type { AsyncResult } from '../types/result';
import { ok, err } from '../types/result';
import type { DatasphereRequestor, DatasphereRequestOptions } from '../types/requestor';
import type { DatasphereObjectTypeName } from '../types/objectTypes';
import type { OAuthTokens } from '../core/auth/oauth';
import type { UpsertLocalTableResult } from '../core/operations/local-table/upsert';
import type { UpsertReplicationFlowResult } from '../core/operations/replication-flow/upsert';
import type { RunReplicationFlowResult } from '../core/operations/replication-flow/run';
import type { UpsertViewResult } from '../core/operations/sql-view/upsert';
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
import type { BdcClient, TokenCache, CsrfCache } from './types';
import { executeRequest } from './request';
import { clientLogin } from './login';

export class BdcClientImpl implements BdcClient {
    readonly config: BdcConfig;
    private tokenCache: TokenCache | null = null;
    private csrfCache: CsrfCache | null = null;
    private requestor: DatasphereRequestor;

    constructor(config: BdcConfig) {
        this.config = config;
        this.requestor = { request: this.request.bind(this) };

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

    private async request(options: DatasphereRequestOptions): AsyncResult<Response, Error> {
        const state = { tokenCache: this.tokenCache, csrfCache: this.csrfCache };
        const [result, error] = await executeRequest(this.config.host, state, options);
        if (error) return err(error);

        this.tokenCache = result.state.tokenCache;
        this.csrfCache = result.state.csrfCache;
        return ok(result.response);
    }

    async login(): AsyncResult<OAuthTokens> {
        const [result, loginErr] = await clientLogin(this.config, this.tokenCache);
        if (loginErr) return err(loginErr);

        this.tokenCache = result.tokenCache;
        this.csrfCache = result.csrfCache;
        return ok(result.tokens);
    }

    // SQL view
    createView(csn: CsnFile, objectName: string): AsyncResult<string> {
        return coreCreateView(this.requestor, this.config.space, csn, objectName);
    }

    readView(objectName: string): AsyncResult<string> {
        return coreReadView(this.requestor, this.config.space, objectName);
    }

    updateView(csn: CsnFile, objectName: string): AsyncResult<string> {
        return coreUpdateView(this.requestor, this.config.space, csn, objectName);
    }

    deleteView(objectName: string): AsyncResult<string> {
        return coreDeleteView(this.requestor, this.config.space, objectName);
    }

    upsertView(csn: CsnFile, objectName: string): AsyncResult<UpsertViewResult> {
        return coreUpsertView(this.requestor, this.config.space, csn, objectName);
    }

    // Local table
    createLocalTable(csn: CsnFile, objectName: string): AsyncResult<string> {
        return coreCreateLocalTable(this.requestor, this.config.space, csn, objectName);
    }

    readLocalTable(objectName: string): AsyncResult<string> {
        return coreReadLocalTable(this.requestor, this.config.space, objectName);
    }

    updateLocalTable(csn: CsnFile, objectName: string): AsyncResult<string> {
        return coreUpdateLocalTable(this.requestor, this.config.space, csn, objectName);
    }

    deleteLocalTable(objectName: string): AsyncResult<string> {
        return coreDeleteLocalTable(this.requestor, this.config.space, objectName);
    }

    upsertLocalTable(csn: CsnFile, objectName: string): AsyncResult<UpsertLocalTableResult> {
        return coreUpsertLocalTable(this.requestor, this.config.space, csn, objectName);
    }

    // Replication flow
    createReplicationFlow(csn: CsnFile, objectName: string): AsyncResult<string> {
        return coreCreateReplicationFlow(this.requestor, this.config.space, csn, objectName);
    }

    readReplicationFlow(objectName: string): AsyncResult<string> {
        return coreReadReplicationFlow(this.requestor, this.config.space, objectName);
    }

    updateReplicationFlow(csn: CsnFile, objectName: string): AsyncResult<string> {
        return coreUpdateReplicationFlow(this.requestor, this.config.space, csn, objectName);
    }

    deleteReplicationFlow(objectName: string): AsyncResult<string> {
        return coreDeleteReplicationFlow(this.requestor, this.config.space, objectName);
    }

    upsertReplicationFlow(csn: CsnFile, objectName: string): AsyncResult<UpsertReplicationFlowResult> {
        return coreUpsertReplicationFlow(this.requestor, this.config.space, csn, objectName);
    }

    runReplicationFlow(flowName: string): AsyncResult<RunReplicationFlowResult> {
        return coreRunReplicationFlow(this.requestor, this.config.space, flowName);
    }

    // Generic
    objectExists(objectType: DatasphereObjectTypeName, technicalName: string): AsyncResult<boolean> {
        return coreObjectExists(this.requestor, this.config.space, objectType, technicalName);
    }

    rawRequest(options: DatasphereRequestOptions): AsyncResult<Response> {
        return this.request(options);
    }
}
