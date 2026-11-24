# BdcClient API

Client API reference, configuration, error handling, and CSN file format.

## Sections

- [Configuration](#configuration)
- [Methods](#methods)
- [Error Handling](#error-handling)
- [CSN Files](#csn-files)

---

## Configuration

Create a client with `createClient(config)`. Returns a `Result<BdcClient>` tuple.

```typescript
interface BdcConfig {
  host: string; // Datasphere tenant URL (e.g. 'https://tenant.us10.hcs.cloud.sap/')
  space: string; // Space ID (e.g. 'MYSPACE')
  verbose?: boolean; // Enable debug logging
  oauth:
    // OAuth credentials (required) — either inline or file reference
    | {
        clientId: string;
        clientSecret: string;
        authorizationUrl: string;
        tokenUrl: string;
      }
    | { optionsFile: string };
  tokens?: TokenConfig; // Pre-provided tokens — skip login()
}
```

`host` and `space` are typically read from environment variables (`DSP_HOST`, `DSP_SPACE`).

---

## Methods

| Method                    | Signature                                                | Description                                                                                                                                                          |
| ------------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `login`                   | `() => AsyncResult<OAuthTokens>`                         | Native OAuth browser flow. Returns tokens.                                                                                                                           |
| `importCsn`               | `(csn) => AsyncResult<ImportCsnResult>`                  | Imports a CSN (single or multi-definition) via `/deepsea/` API, then deploys.                                                                                        |
| `readAnalyticModel`       | `(objectName) => AsyncResult<string>`                    | Reads an analytic model definition via GET.                                                                                                                          |
| `readView`                | `(objectName) => AsyncResult<string>`                    | Reads a view definition via GET.                                                                                                                                     |
| `readLocalTable`          | `(objectName) => AsyncResult<string>`                    | Reads a local table definition via GET.                                                                                                                              |
| `readReplicationFlow`     | `(objectName) => AsyncResult<string>`                    | Reads a replication flow definition via GET.                                                                                                                         |
| `readTaskChain`           | `(objectName) => AsyncResult<string>`                    | Reads a task chain definition via GET (`taskchains` endpoint, not yet confirmed on a tenant).                                                                        |
| `deleteAnalyticModel`     | `(objectName) => AsyncResult<string>`                    | Deletes an analytic model via DELETE.                                                                                                                                |
| `deleteView`              | `(objectName, options?) => AsyncResult<string>`          | Deletes a view via DELETE. Forced (`deleteAnyway=true`) unless `{ deleteAnyway: false }`, which lets Datasphere refuse while something uses the view.                |
| `deleteLocalTable`        | `(objectName) => AsyncResult<string>`                    | Deletes a local table via DELETE.                                                                                                                                    |
| `deleteReplicationFlow`   | `(objectName) => AsyncResult<string>`                    | Deletes a replication flow via DELETE.                                                                                                                               |
| `deleteTaskChain`         | `(objectName, options?) => AsyncResult<string>`          | Deletes a task chain via DELETE. Forced (`deleteAnyway=true`) unless `{ deleteAnyway: false }` (since v0.6.0), which lets Datasphere refuse while something uses it. |
| **Data access controls**  |                                                          |                                                                                                                                                                      |
| `listDataAccessControls`  | `(options?) => AsyncResult<string[]>`                    | Technical names of the space's controls. `{ top, skip }` reads one page; without `top`, every page (25 at a time). `technicalNames` filters.                         |
| `readDataAccessControl`   | `(objectName) => AsyncResult<string>`                    | The control as saved, `{"definitions": {NAME: {...}}}`.                                                                                                              |
| `createDataAccessControl` | `(content, options?) => AsyncResult<string>`             | POSTs the control's CSN and deploys it.                                                                                                                              |
| `updateDataAccessControl` | `(objectName, content, options?) => AsyncResult<string>` | PUTs the control's CSN and deploys it.                                                                                                                               |
| `deleteDataAccessControl` | `(objectName, options?) => AsyncResult<string>`          | Not forced (`deleteAnyway=false`) unless `{ deleteAnyway: true }`: Datasphere refuses while something uses the control.                                              |
| `runReplicationFlow`      | `(flowName) => AsyncResult<RunReplicationFlowResult>`    | Triggers a replication flow run.                                                                                                                                     |
| `objectExists`            | `(objectType, name) => AsyncResult<boolean>`             | Checks if an object exists (GET + 200 check).                                                                                                                        |
| `previewData`             | `(viewName, options?) => AsyncResult<DataPreviewResult>` | Fetches data rows from a deployed view via OData.                                                                                                                    |
| `getViewColumns`          | `(viewName) => AsyncResult<ViewColumn[]>`                | Fetches column metadata from a view's OData `$metadata`.                                                                                                             |
| **Navigator**             |                                                          |                                                                                                                                                                      |
| `listObjects`             | `(options?) => AsyncResult<SearchObject[]>`              | Lists all design objects in the space with auto-pagination.                                                                                                          |
| `listFolders`             | `(parentFolderId?) => AsyncResult<SpaceFolder[]>`        | Lists folders in the space. Pass a parent ID to drill into subfolders.                                                                                               |
| `searchObjects`           | `(options?) => AsyncResult<SearchResult>`                | Raw search API access with text queries, kind filtering, and pagination.                                                                                             |
| **INA (Experimental)**    |                                                          |                                                                                                                                                                      |
| `inaGetServerInfo`        | `() => AsyncResult<InaServerInfo>`                       | INA server connectivity and capability check.                                                                                                                        |
| `inaGetMetadata`          | `(dataSource) => AsyncResult<InaMetadataResult>`         | Retrieves dimensions, measures, and variables for an analytic model.                                                                                                 |
| `inaQueryData`            | `(options) => AsyncResult<InaQueryResult>`               | Queries data from an analytic model via the INA protocol.                                                                                                            |

All methods return `AsyncResult<T>` which is `Promise<[T, null] | [null, Error]>`.

### Data Access Controls

Controls are not imported through `importCsn`. They use the documented `/dwaas-core/api/v1/spaces/{space}/dataaccesscontrols` endpoints, and every query parameter is sent explicitly, as SAP's `datasphere` CLI sends it:

| Option (`ObjectWriteOptions`) | Default | Meaning                                         |
| ----------------------------- | ------- | ----------------------------------------------- |
| `deploy`                      | `true`  | Deploy after saving                             |
| `saveAnyway`                  | `false` | Save despite validation messages                |
| `allowMissingDependencies`    | `false` | Save although objects it depends on are missing |

`DeleteOptions` has `deleteAnyway`. It defaults to `false` for controls and `true` for views and task chains, which keeps their old behaviour. All three option types are exported from the package entry.

`client.capabilities` lists what a build can do that a caller cannot tell from a method's presence (`CLIENT_CAPABILITIES`, exported). `'task-chain-delete-options'` (v0.6.0): `deleteTaskChain` honours `{ deleteAnyway }`; an older build ignores the options and forces the delete. `'task-schedules'`: the schedule and task run methods below.

```typescript
const csn = JSON.parse(
  readFileSync("csn/data_access_controls/MY_DAC.json", "utf-8"),
);
const [, createErr] = await client.createDataAccessControl(csn); // saved and deployed
const [, deleteErr] = await client.deleteDataAccessControl("MY_DAC"); // refused while in use
```

### Schedules and Task Runs

Schedules go through Datasphere's internal task-framework endpoint (`/dwaas-core/tf/{space}/schedules`, undocumented, the Data Builder's own; verified on a tenant 2026-11-24); the consent, runs and logs through the documented `/dwaas-core/api/v1/tasks` endpoints SAP's CLI calls.

| Method            | Signature                                              | Description                                                                                                                                                         |
| ----------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `listSchedules`   | `() => AsyncResult<TaskSchedule[]>`                    | Every schedule of the space: `scheduleId`, `applicationId` (`TASK_CHAINS`), `activity` (`RUN_CHAIN`), `objectId`, `cron`, `activationStatus`, `owner`, `nextRun`; `timezone` only when a record carries one (none seen: the cron is UTC). |
| `createSchedule`  | `(input: CreateScheduleInput) => AsyncResult<{ scheduleId }>` | `POST` with `applicationId`, `activity`, `objectId`, `description` (default the object), `cron`, `activationStatus` (default `ENABLED`); owned by the signed-in user. |
| `deleteSchedule`  | `(scheduleId) => AsyncResult<void>`                    | `DELETE` (204).                                                                                                                                                     |
| `readTaskConsent` | `() => AsyncResult<TaskConsent>`                       | The signed-in user's consent to run tasks: `status` (`CONSENT_GIVEN`, `NO_CONSENT`, `CONSENT_EXPIRED`), `createdAt`, `validUntil`. No one can read another user's.    |
| `readCurrentUser` | `() => AsyncResult<string \| null>`                    | The signed-in user's Datasphere user name (what a schedule's `owner` holds), from the shell's session endpoint.                                                      |
| `runTaskChain`    | `(chainName) => AsyncResult<{ logId }>`                | Starts a run.                                                                                                                                                       |
| `readTaskLog`     | `(logId) => AsyncResult<TaskLog>`                      | `status` (`RUNNING`, `COMPLETED`, `FAILED`), times, `children` (one per task), `messages`.                                                                           |

---

## Error Handling

The library uses Go-style Result tuples instead of thrown exceptions:

```typescript
type Result<T> = [T, null] | [null, Error];
type AsyncResult<T> = Promise<Result<T>>;
```

Every fallible operation returns a Result. Always check the error before using the data:

```typescript
const [result, error] = await client.importCsn(csn);
if (error) {
  console.error(error.message);
  return;
}
// result is guaranteed non-null here
console.log(`Imported ${result.objectIds.length} objects`);
```

---

## CSN Files

CSN (Core Schema Notation) files are JSON exports from SAP Datasphere. They contain object definitions.

### Structure

```typescript
interface CsnFile {
  definitions?: Record<string, CsnEntity>; // views, local tables, analytic models
  replicationflows?: Record<string, CsnReplicationFlow>; // replication flows
  version?: { csn: string };
  meta?: { creator: string };
  $version?: string;
}
```

- **Views, local tables, and analytic models** are stored under `definitions`
- **Replication flows** are stored under `replicationflows`
- A CSN file can contain **multiple definitions** — `importCsn` sends them all in a single request
- Multiple CSN files can be merged by combining their `definitions` objects before importing

---

_Last updated: v0.5.0_
