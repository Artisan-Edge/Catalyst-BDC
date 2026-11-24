export { login } from './login';
export { objectExists } from './objectExists';

// Local table
export { readLocalTable, deleteLocalTable } from './local-table';

// Replication flow
export { readReplicationFlow, deleteReplicationFlow, runReplicationFlow } from './replication-flow';
export type { RunReplicationFlowResult } from './replication-flow';

// Transformation flow
export { readTransformationFlow, deleteTransformationFlow, runTransformationFlow } from './transformation-flow';
export type { RunTransformationFlowResult } from './transformation-flow';

// Task chain
export { readTaskChain, deleteTaskChain } from './task-chain';

// Schedules, task consent, task runs and logs
export { listSchedules, createSchedule, deleteSchedule } from './task-schedule';
export type { TaskSchedule, CreateScheduleInput } from './task-schedule';
export { readTaskConsent, runTaskChain, readTaskLog, readCurrentUser } from './task';
export type { TaskConsent, TaskLog } from './task';

// Analytic model
export { readAnalyticModel, deleteAnalyticModel } from './analytic-model';

// SQL view
export { readView, deleteView } from './sql-view';

// Data access control
export { listDataAccessControls, readDataAccessControl, createDataAccessControl, updateDataAccessControl, deleteDataAccessControl } from './data-access-control';

// Import (multi-definition CSN via /deepsea/ API)
export { resolveSpaceId, importCsn, deployObjects } from './import';
export type { ImportCsnResult } from './import';

// Navigator
export { listObjects, listFolders, searchObjects } from './navigator';
export type { SearchResult } from './navigator';

// Data preview
export { previewData, getViewColumns } from './navigator';
export type { DataPreviewOptions, DataPreviewResult, ViewColumn } from './navigator';
