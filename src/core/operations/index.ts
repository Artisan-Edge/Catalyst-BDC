export { login } from './login';
export { objectExists } from './objectExists';

// Local table
export { readLocalTable, deleteLocalTable } from './local-table';

// Replication flow
export { readReplicationFlow, deleteReplicationFlow, runReplicationFlow } from './replication-flow';
export type { RunReplicationFlowResult } from './replication-flow';

// Analytic model
export { readAnalyticModel, deleteAnalyticModel } from './analytic-model';

// SQL view
export { readView, deleteView } from './sql-view';

// Import (multi-definition CSN via /deepsea/ API)
export { resolveSpaceId, importCsn, deployObjects } from './import';
export type { ImportCsnResult } from './import';

// Navigator
export { listObjects, listFolders, searchObjects } from './navigator';
export type { SearchResult } from './navigator';

// Data preview
export { previewData, getViewColumns } from './navigator';
export type { DataPreviewOptions, DataPreviewResult, ViewColumn } from './navigator';
