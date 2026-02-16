export { login } from './login';
export { objectExists } from './objectExists';

// Local table
export { createLocalTable, readLocalTable, updateLocalTable, deleteLocalTable, upsertLocalTable } from './local-table';
export type { UpsertLocalTableResult } from './local-table';

// Replication flow
export { createReplicationFlow, readReplicationFlow, updateReplicationFlow, deleteReplicationFlow, upsertReplicationFlow, runReplicationFlow } from './replication-flow';
export type { UpsertReplicationFlowResult, RunReplicationFlowResult } from './replication-flow';

// SQL view
export { createView, readView, updateView, deleteView, upsertView } from './sql-view';
export type { UpsertViewResult } from './sql-view';
