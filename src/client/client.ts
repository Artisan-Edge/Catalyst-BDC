import type { BdcConfig } from "../types/config";
import type { CsnFile } from "../types/csn";
import type { AsyncResult } from "../types/result";
import { err } from "../types/result";
import type { CliExecutor } from "../core/cli/executor";
import type { UpsertLocalTableResult } from "../core/operations/local-table/upsert";
import type { UpsertReplicationFlowResult } from "../core/operations/replication-flow/upsert";
import type { RunReplicationFlowResult } from "../core/operations/replication-flow/run";
import type { UpsertViewResult } from "../core/operations/sql-view/upsert";
import type { SessionData } from "../core/http/session";
import { login as coreLogin } from "../core/operations/login";
import { createView as coreCreateView } from "../core/operations/sql-view/create";
import { readView as coreReadView } from "../core/operations/sql-view/read";
import { updateView as coreUpdateView } from "../core/operations/sql-view/update";
import { deleteView as coreDeleteView } from "../core/operations/sql-view/delete";
import { upsertView as coreUpsertView } from "../core/operations/sql-view/upsert";
import { createLocalTable as coreCreateLocalTable } from "../core/operations/local-table/create";
import { readLocalTable as coreReadLocalTable } from "../core/operations/local-table/read";
import { updateLocalTable as coreUpdateLocalTable } from "../core/operations/local-table/update";
import { deleteLocalTable as coreDeleteLocalTable } from "../core/operations/local-table/delete";
import { upsertLocalTable as coreUpsertLocalTable } from "../core/operations/local-table/upsert";
import { createReplicationFlow as coreCreateReplicationFlow } from "../core/operations/replication-flow/create";
import { readReplicationFlow as coreReadReplicationFlow } from "../core/operations/replication-flow/read";
import { updateReplicationFlow as coreUpdateReplicationFlow } from "../core/operations/replication-flow/update";
import { deleteReplicationFlow as coreDeleteReplicationFlow } from "../core/operations/replication-flow/delete";
import { upsertReplicationFlow as coreUpsertReplicationFlow } from "../core/operations/replication-flow/upsert";
import { runReplicationFlow as coreRunReplicationFlow } from "../core/operations/replication-flow/run";
import { objectExists as coreObjectExists } from "../core/operations/objectExists";
import { DSP_OBJECT_TYPES } from "../types/objectTypes";
import type { DspObjectTypeName } from "../types/objectTypes";
import { getAccessToken, fetchCsrf, TOKEN_EXPIRY_BUFFER_SEC } from "../core/http/session";

interface SessionCache {
    data: SessionData;
    expiresAfter: number;
}

export interface BdcClient {
    readonly config: BdcConfig;
    login(): AsyncResult<void>;

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
    objectExists(objectType: DspObjectTypeName, technicalName: string): AsyncResult<boolean>;
}

export class BdcClientImpl implements BdcClient {
    readonly config: BdcConfig;
    private executor: CliExecutor;
    private session: SessionCache | null = null;

    constructor(config: BdcConfig, executor: CliExecutor) {
        this.config = config;
        this.executor = executor;
    }

    private async ensureSession(): AsyncResult<SessionData> {
        const nowSec = Math.floor(Date.now() / 1000);

        if (this.session && this.session.expiresAfter > nowSec + TOKEN_EXPIRY_BUFFER_SEC) {
            return [this.session.data, null];
        }

        const [tokenResult, tokenErr] = await getAccessToken(this.config.host);
        if (tokenErr) return err(tokenErr);

        const [csrfResult, csrfErr] = await fetchCsrf(this.config.host, tokenResult.accessToken);
        if (csrfErr) return err(csrfErr);

        this.session = {
            data: {
                accessToken: tokenResult.accessToken,
                csrf: csrfResult.csrf,
                cookies: csrfResult.cookies,
            },
            expiresAfter: tokenResult.expiresAfter,
        };

        return [this.session.data, null];
    }

    async login(): AsyncResult<void> {
        return coreLogin(this.config);
    }

    // SQL view
    async createView(csn: CsnFile, objectName: string): AsyncResult<string> {
        return coreCreateView(csn, objectName, this.executor);
    }

    async readView(objectName: string): AsyncResult<string> {
        return coreReadView(objectName, this.executor);
    }

    async updateView(csn: CsnFile, objectName: string): AsyncResult<string> {
        return coreUpdateView(csn, objectName, this.executor);
    }

    async deleteView(objectName: string): AsyncResult<string> {
        return coreDeleteView(objectName, this.executor);
    }

    async upsertView(csn: CsnFile, objectName: string): AsyncResult<UpsertViewResult> {
        return coreUpsertView(csn, objectName, this.executor);
    }

    // Local table
    async createLocalTable(csn: CsnFile, objectName: string): AsyncResult<string> {
        return coreCreateLocalTable(csn, objectName, this.executor);
    }

    async readLocalTable(objectName: string): AsyncResult<string> {
        return coreReadLocalTable(objectName, this.executor);
    }

    async updateLocalTable(csn: CsnFile, objectName: string): AsyncResult<string> {
        return coreUpdateLocalTable(csn, objectName, this.executor);
    }

    async deleteLocalTable(objectName: string): AsyncResult<string> {
        return coreDeleteLocalTable(objectName, this.executor);
    }

    async upsertLocalTable(csn: CsnFile, objectName: string): AsyncResult<UpsertLocalTableResult> {
        return coreUpsertLocalTable(csn, objectName, this.executor);
    }

    // Replication flow
    async createReplicationFlow(csn: CsnFile, objectName: string): AsyncResult<string> {
        return coreCreateReplicationFlow(csn, objectName, this.executor);
    }

    async readReplicationFlow(objectName: string): AsyncResult<string> {
        return coreReadReplicationFlow(objectName, this.executor);
    }

    async updateReplicationFlow(csn: CsnFile, objectName: string): AsyncResult<string> {
        return coreUpdateReplicationFlow(csn, objectName, this.executor);
    }

    async deleteReplicationFlow(objectName: string): AsyncResult<string> {
        return coreDeleteReplicationFlow(objectName, this.executor);
    }

    async upsertReplicationFlow(csn: CsnFile, objectName: string): AsyncResult<UpsertReplicationFlowResult> {
        return coreUpsertReplicationFlow(csn, objectName, this.executor);
    }

    async runReplicationFlow(flowName: string): AsyncResult<RunReplicationFlowResult> {
        const [session, sessionErr] = await this.ensureSession();
        if (sessionErr) return err(sessionErr);

        return coreRunReplicationFlow(flowName, this.config, session);
    }

    // Generic
    async objectExists(objectType: DspObjectTypeName, technicalName: string): AsyncResult<boolean> {
        const { readCommand } = DSP_OBJECT_TYPES[objectType];
        return coreObjectExists(readCommand, technicalName, this.executor);
    }
}
