import type { BdcConfig } from '../types/config';
import type { CsnFile } from '../types/csn';
import type { AsyncResult } from '../types/result';
import { err } from '../types/result';
import type { CliExecutor } from '../core/cli/executor';
import type { ReplicationFlowResult } from '../core/operations/upsertReplicationFlow';
import type { RunReplicationFlowResult } from '../core/operations/runReplicationFlow';
import type { SessionData } from '../core/http/session';
import type { DeletableObjectType } from '../core/operations/deleteObject';
import { login as coreLogin } from '../core/operations/login';
import { createView as coreCreateView } from '../core/operations/createView';
import { createLocalTable as coreCreateLocalTable } from '../core/operations/createLocalTable';
import { upsertReplicationFlow as coreUpsertReplicationFlow } from '../core/operations/upsertReplicationFlow';
import { runReplicationFlow as coreRunReplicationFlow } from '../core/operations/runReplicationFlow';
import { deleteObject as coreDeleteObject } from '../core/operations/deleteObject';
import { getAccessToken, fetchCsrf, TOKEN_EXPIRY_BUFFER_SEC } from '../core/http/session';

interface SessionCache {
    data: SessionData;
    expiresAfter: number;
}

export interface BdcClient {
    readonly config: BdcConfig;
    login(): AsyncResult<void>;
    createView(csn: CsnFile, objectName: string): AsyncResult<string>;
    createLocalTable(csn: CsnFile, objectName: string): AsyncResult<string>;
    upsertReplicationFlow(csn: CsnFile, objectName: string, runFlowAfter?: boolean): AsyncResult<ReplicationFlowResult>;
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

    async createLocalTable(csn: CsnFile, objectName: string): AsyncResult<string> {
        return coreCreateLocalTable(csn, objectName, this.executor);
    }

    async upsertReplicationFlow(csn: CsnFile, objectName: string, runFlowAfter = false): AsyncResult<ReplicationFlowResult> {
        const [result, upsertErr] = await coreUpsertReplicationFlow(csn, objectName, this.executor);
        if (upsertErr) return err(upsertErr);

        if (!runFlowAfter) return [result, null];

        const [runResult, runErr] = await this.runReplicationFlow(objectName);
        if (runErr) return err(runErr);

        return [{ ...result, runResult }, null];
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
