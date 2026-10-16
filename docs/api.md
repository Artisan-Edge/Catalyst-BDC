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
    host: string;       // Datasphere tenant URL (e.g. 'https://tenant.us10.hcs.cloud.sap/')
    space: string;      // Space ID (e.g. 'MYSPACE')
    verbose?: boolean;  // Enable debug logging
    oauth:              // OAuth credentials (required) — either inline or file reference
        | { clientId: string; clientSecret: string; authorizationUrl: string; tokenUrl: string }
        | { optionsFile: string };
    tokens?: TokenConfig;  // Pre-provided tokens — skip login()
}
```

`host` and `space` are typically read from environment variables (`DSP_HOST`, `DSP_SPACE`).

---

## Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `login` | `() => AsyncResult<OAuthTokens>` | Native OAuth browser flow. Returns tokens. |
| `importCsn` | `(csn) => AsyncResult<ImportCsnResult>` | Imports a CSN (single or multi-definition) via `/deepsea/` API, then deploys. |
| `readAnalyticModel` | `(objectName) => AsyncResult<string>` | Reads an analytic model definition via GET. |
| `readView` | `(objectName) => AsyncResult<string>` | Reads a view definition via GET. |
| `readLocalTable` | `(objectName) => AsyncResult<string>` | Reads a local table definition via GET. |
| `readReplicationFlow` | `(objectName) => AsyncResult<string>` | Reads a replication flow definition via GET. |
| `deleteAnalyticModel` | `(objectName) => AsyncResult<string>` | Deletes an analytic model via DELETE. |
| `deleteView` | `(objectName) => AsyncResult<string>` | Deletes a view via DELETE. |
| `deleteLocalTable` | `(objectName) => AsyncResult<string>` | Deletes a local table via DELETE. |
| `deleteReplicationFlow` | `(objectName) => AsyncResult<string>` | Deletes a replication flow via DELETE. |
| `runReplicationFlow` | `(flowName) => AsyncResult<RunReplicationFlowResult>` | Triggers a replication flow run. |
| `objectExists` | `(objectType, name) => AsyncResult<boolean>` | Checks if an object exists (GET + 200 check). |
| `previewData` | `(viewName, options?) => AsyncResult<DataPreviewResult>` | Fetches data rows from a deployed view via OData. |
| `getViewColumns` | `(viewName) => AsyncResult<ViewColumn[]>` | Fetches column metadata from a view's OData `$metadata`. |
| **Navigator** | | |
| `listObjects` | `(options?) => AsyncResult<SearchObject[]>` | Lists all design objects in the space with auto-pagination. |
| `listFolders` | `(parentFolderId?) => AsyncResult<SpaceFolder[]>` | Lists folders in the space. Pass a parent ID to drill into subfolders. |
| `searchObjects` | `(options?) => AsyncResult<SearchResult>` | Raw search API access with text queries, kind filtering, and pagination. |
| **INA (Experimental)** | | |
| `inaGetServerInfo` | `() => AsyncResult<InaServerInfo>` | INA server connectivity and capability check. |
| `inaGetMetadata` | `(dataSource) => AsyncResult<InaMetadataResult>` | Retrieves dimensions, measures, and variables for an analytic model. |
| `inaQueryData` | `(options) => AsyncResult<InaQueryResult>` | Queries data from an analytic model via the INA protocol. |

All methods return `AsyncResult<T>` which is `Promise<[T, null] | [null, Error]>`.

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
    definitions?: Record<string, CsnEntity>;              // views, local tables, analytic models
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

*Last updated: v0.2.1*
