import type { BdcConfig } from '../types/config';
import type { CsnFile } from '../types/csn';
import type { AsyncResult } from '../types/result';
import type { DatasphereRequestOptions } from '../types/requestor';
import type { DatasphereObjectTypeName } from '../types/objectTypes';
import type { DeleteOptions, ListOptions, ObjectWriteOptions } from '../types/operationOptions';
import type { SearchObject, ListObjectsOptions, SearchOptions, SpaceFolder } from '../types/designObject';
import type { OAuthTokens } from '../core/auth/oauth';
import type { RunReplicationFlowResult } from '../core/operations/replication-flow/run';
import type { RunTransformationFlowResult } from '../core/operations/transformation-flow/run';
import type { ImportCsnResult } from '../core/operations/import/importCsn';
import type { SearchResult } from '../core/operations/navigator/searchObjects';
import type { DataPreviewOptions, DataPreviewResult } from '../core/operations/navigator/previewData';
import type { ViewColumn } from '../core/operations/navigator/getViewColumns';
import type { TaskSchedule, CreateScheduleInput } from '../core/operations/task-schedule';
import type { TaskConsent, TaskLog } from '../core/operations/task';
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

// What this build can do that an older one cannot tell by a method's presence (callers test for a name):
// 'task-chain-delete-options' = deleteTaskChain honours { deleteAnyway } (an older build ignores it and forces)
// 'task-schedules' = schedules (list, create, delete), the task consent, task chain runs and their logs, the user name
export const CLIENT_CAPABILITIES = ['task-chain-delete-options', 'task-schedules'] as const;
export type ClientCapability = (typeof CLIENT_CAPABILITIES)[number];

export interface BdcClient {
    readonly config: BdcConfig;
    readonly capabilities: readonly ClientCapability[];
    login(): AsyncResult<OAuthTokens>;
    logout(): AsyncResult<boolean>;

    // Read
    readAnalyticModel(objectName: string): AsyncResult<string>;
    readView(objectName: string): AsyncResult<string>;
    readLocalTable(objectName: string): AsyncResult<string>;
    readReplicationFlow(objectName: string): AsyncResult<string>;
    readTransformationFlow(objectName: string): AsyncResult<string>;
    readTaskChain(objectName: string): AsyncResult<string>;

    // Delete
    deleteAnalyticModel(objectName: string): AsyncResult<string>;
    // Forced (deleteAnyway=true) unless { deleteAnyway: false }
    deleteView(objectName: string, options?: DeleteOptions): AsyncResult<string>;
    deleteLocalTable(objectName: string): AsyncResult<string>;
    deleteReplicationFlow(objectName: string): AsyncResult<string>;
    deleteTransformationFlow(objectName: string): AsyncResult<string>;
    // Forced (deleteAnyway=true) unless { deleteAnyway: false }
    deleteTaskChain(objectName: string, options?: DeleteOptions): AsyncResult<string>;

    // Data access control (the documented /dwaas-core/api/v1 endpoints). Writes deploy by default; delete is
    // not forced unless { deleteAnyway: true }
    listDataAccessControls(options?: ListOptions): AsyncResult<string[]>;
    readDataAccessControl(objectName: string): AsyncResult<string>;
    createDataAccessControl(content: CsnFile, options?: ObjectWriteOptions): AsyncResult<string>;
    updateDataAccessControl(objectName: string, content: CsnFile, options?: ObjectWriteOptions): AsyncResult<string>;
    deleteDataAccessControl(objectName: string, options?: DeleteOptions): AsyncResult<string>;

    // Replication flow
    runReplicationFlow(flowName: string): AsyncResult<RunReplicationFlowResult>;

    // Transformation flow
    runTransformationFlow(flowName: string): AsyncResult<RunTransformationFlowResult>;

    // Schedules and task runs (the space's schedules through the internal /dwaas-core/tf endpoint; consent, runs and
    // logs through the documented /dwaas-core/api/v1/tasks endpoints)
    listSchedules(): AsyncResult<TaskSchedule[]>;
    createSchedule(input: CreateScheduleInput): AsyncResult<{ scheduleId: string }>;
    deleteSchedule(scheduleId: string): AsyncResult<void>;
    // The signed-in user's consent to run tasks (nobody can read another user's)
    readTaskConsent(): AsyncResult<TaskConsent>;
    runTaskChain(chainName: string): AsyncResult<{ logId: number }>;
    readTaskLog(logId: number): AsyncResult<TaskLog>;
    // The signed-in user's Datasphere user name (a schedule's owner is named so); null when unknown
    readCurrentUser(): AsyncResult<string | null>;

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
