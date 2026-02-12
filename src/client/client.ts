import type { BdcConfig } from "../types/config";
import type { CsnFile } from "../types/csn";
import type { AsyncResult } from "../types/result";
import { err } from "../types/result";
import type { CliExecutor } from "../core/cli/executor";
import type { LocalTableResult } from "../core/operations/createLocalTable";
import type { ReplicationFlowResult } from "../core/operations/createReplicationFlow";
import type { RunReplicationFlowResult } from "../core/operations/runReplicationFlow";
import type { SessionData } from "../core/http/session";
import type { DeletableObjectType } from "../core/operations/deleteObject";
import { login as coreLogin } from "../core/operations/login";
import { createView as coreCreateView } from "../core/operations/createView";
import { createLocalTable as coreCreateLocalTable } from "../core/operations/createLocalTable";
import { createReplicationFlow as coreCreateReplicationFlow } from "../core/operations/createReplicationFlow";
import { runReplicationFlow as coreRunReplicationFlow } from "../core/operations/runReplicationFlow";
import { deleteObject as coreDeleteObject } from "../core/operations/deleteObject";
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
    createView(csn: CsnFile, objectName: string): AsyncResult<string>;
    createLocalTable(csn: CsnFile, objectName: string): AsyncResult<LocalTableResult>;
    createReplicationFlow(csn: CsnFile, objectName: string, runFlowAfter?: boolean): AsyncResult<ReplicationFlowResult>;
    objectExists(objectType: DspObjectTypeName, technicalName: string): AsyncResult<boolean>;
    deleteObject(objectType: DeletableObjectType, technicalName: string): AsyncResult<string>;
    runReplicationFlow(flowName: string): AsyncResult<RunReplicationFlowResult>;
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

    async createView(csn: CsnFile, objectName: string): AsyncResult<string> {
        return coreCreateView(csn, objectName, this.executor);
    }

    async createLocalTable(csn: CsnFile, objectName: string): AsyncResult<LocalTableResult> {
        return coreCreateLocalTable(csn, objectName, this.executor);
    }

    async createReplicationFlow(csn: CsnFile, objectName: string, runFlowAfter = false): AsyncResult<ReplicationFlowResult> {
        const [result, createErr] = await coreCreateReplicationFlow(csn, objectName, this.executor);
        if (createErr) return err(createErr);

        if (!runFlowAfter) return [result, null];

        const [runResult, runErr] = await this.runReplicationFlow(objectName);
        if (runErr) return err(runErr);

        return [{ ...result, runResult }, null];
    }

    async objectExists(objectType: DspObjectTypeName, technicalName: string): AsyncResult<boolean> {
        const { readCommand } = DSP_OBJECT_TYPES[objectType];
        return coreObjectExists(readCommand, technicalName, this.executor);
    }

    async deleteObject(objectType: DeletableObjectType, technicalName: string): AsyncResult<string> {
        return coreDeleteObject(objectType, technicalName, this.executor);
    }

    async runReplicationFlow(flowName: string): AsyncResult<RunReplicationFlowResult> {
        const [session, sessionErr] = await this.ensureSession();
        if (sessionErr) return err(sessionErr);

        return coreRunReplicationFlow(flowName, this.config, session);
    }
}
