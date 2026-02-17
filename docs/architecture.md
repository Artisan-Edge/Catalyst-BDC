# Architecture

Layered TypeScript library for direct HTTP API communication with SAP Datasphere.

## Sections

- [Module Hierarchy](#module-hierarchy)
- [Import Rules](#import-rules)
- [Key Patterns](#key-patterns)
- [BdcClient API](#bdcclient-api)
- [Configuration](#configuration)
- [Request Lifecycle](#request-lifecycle)

---

## Module Hierarchy

```
src/
├── types/               # Shared type definitions (leaf — no internal imports)
│   ├── result.ts        # Result<T,E>, AsyncResult, ok(), err()
│   ├── config.ts        # BdcConfig, OAuthConfig, TokenConfig + Zod schemas
│   ├── csn.ts           # CsnFile, CsnEntity, CsnReplicationFlow
│   ├── objectTypes.ts   # DATASPHERE_OBJECT_TYPES registry, DatasphereObjectType
│   ├── requestor.ts     # DatasphereRequestor, DatasphereRequestOptions
│   └── index.ts
├── core/
│   ├── utils/           # Debug logging, safe JSON parsing (leaf)
│   │   ├── logging.ts
│   │   └── json.ts
│   ├── auth/            # Native OAuth browser flow
│   │   └── oauth.ts     # performOAuthLogin() — authorization code flow
│   ├── http/            # HTTP helpers
│   │   ├── helpers.ts   # checkResponse(), buildDatasphereUrl()
│   │   └── session.ts   # refreshAccessToken(), fetchCsrf()
│   ├── csn/             # CSN file manipulation
│   │   ├── extract.ts   # extractObject() — isolates single object
│   │   ├── validate.ts  # validateCsnFile() — structural checks
│   │   └── resolveDeps.ts  # resolveDependencies() — pre-dep names
│   ├── operations/      # Business logic (one function per file)
│   │   ├── login.ts     # OAuth login via performOAuthLogin
│   │   ├── objectExists.ts  # GET + check 200 vs 404
│   │   ├── sql-view/    # create, read, update, delete, upsert
│   │   ├── local-table/ # create, read, update, delete, upsert
│   │   └── replication-flow/  # create, read, update, delete, upsert, run
│   └── index.ts
├── client/              # Public API surface
│   ├── client.ts        # BdcClient interface + BdcClientImpl (self-referencing requestor)
│   └── index.ts         # createClient() factory
└── index.ts             # Root barrel — public exports only
```

---

## Import Rules

Strict hierarchy — no circular dependencies:

```
types/            ← zod only
core/utils/       ← (leaf)
core/auth/        ← types/, core/utils/
core/http/        ← types/, core/utils/
core/csn/         ← types/
core/operations/  ← types/, core/auth/, core/http/, core/csn/, core/utils/
client/           ← types/, core/operations/, core/http/, core/utils/
index.ts          ← client/, types/, core/
```

---

## Key Patterns

### DatasphereRequestor

All operations receive a `DatasphereRequestor` interface instead of directly calling `fetch`. The client implements this interface via a self-referencing binding:

```typescript
interface DatasphereRequestor {
    request(options: DatasphereRequestOptions): AsyncResult<Response, Error>;
}

// In BdcClientImpl:
this.requestor = { request: this.request.bind(this) };
```

This pattern (from Catalyst-Relay's `AdtRequestor`) allows:
- Automatic token refresh on expiry
- CSRF auto-retry on 403
- Operations to be tested with custom requestors

### Result Tuples

All fallible operations return `Result<T, Error>` — no thrown exceptions:

```typescript
type Result<T, E extends Error = Error> = [T, null] | [null, E];

const [data, error] = await client.createView(csn, 'MyView');
if (error) { /* handle */ }
// data is guaranteed non-null
```

### CRUD Endpoint Mapping

| Operation | Method | Path | Query Params |
|-----------|--------|------|-------------|
| create | POST | `/dwaas-core/api/v1/spaces/{space}/{endpoint}` | `saveAnyway=true&allowMissingDependencies=true&deploy=true` |
| read | GET | `/dwaas-core/api/v1/spaces/{space}/{endpoint}/{name}` | — |
| update | PUT | `/dwaas-core/api/v1/spaces/{space}/{endpoint}/{name}` | `saveAnyway=true&allowMissingDependencies=true&deploy=true` |
| delete | DELETE | `/dwaas-core/api/v1/spaces/{space}/{endpoint}/{name}` | `deleteAnyway=true` |
| run | POST | `/dwaas-core/replicationflow/space/{space}/flows/{name}/run` | — |

### One Function Per File

Each file in `core/operations/` exports a single function. This keeps each operation independently importable and testable.

### Barrel Exports

Every directory has an `index.ts` that re-exports its contents.

---

## BdcClient API

```typescript
interface BdcClient {
    readonly config: BdcConfig;
    login(): AsyncResult<OAuthTokens>;

    createView(csn, objectName): AsyncResult<string>;
    readView(objectName): AsyncResult<string>;
    updateView(csn, objectName): AsyncResult<string>;
    deleteView(objectName): AsyncResult<string>;
    upsertView(csn, objectName): AsyncResult<UpsertViewResult>;

    createLocalTable(csn, objectName): AsyncResult<string>;
    readLocalTable(objectName): AsyncResult<string>;
    updateLocalTable(csn, objectName): AsyncResult<string>;
    deleteLocalTable(objectName): AsyncResult<string>;
    upsertLocalTable(csn, objectName): AsyncResult<UpsertLocalTableResult>;

    createReplicationFlow(csn, objectName): AsyncResult<string>;
    readReplicationFlow(objectName): AsyncResult<string>;
    updateReplicationFlow(csn, objectName): AsyncResult<string>;
    deleteReplicationFlow(objectName): AsyncResult<string>;
    upsertReplicationFlow(csn, objectName): AsyncResult<UpsertReplicationFlowResult>;
    runReplicationFlow(flowName): AsyncResult<RunReplicationFlowResult>;

    objectExists(objectType, technicalName): AsyncResult<boolean>;
}
```

Created via factory with Zod validation:

```typescript
const [client, err] = createClient({ host, space, oauth });
```

---

## Configuration

```typescript
interface BdcConfig {
    host: string;          // Datasphere tenant URL
    space: string;         // Space ID
    verbose?: boolean;     // Enable debug logging
    oauth: OAuthConfig | { optionsFile: string };  // Required
    tokens?: TokenConfig;  // Optional: skip login() for CI/headless
}
```

OAuth accepts either inline credentials or a path to a JSON options file.

`TokenConfig` allows pre-providing access/refresh tokens for headless environments where a browser login isn't possible.

---

## Request Lifecycle

A typical `createView` call:

1. **Ensure access token** — check cached token expiry, refresh if needed
2. **Ensure CSRF** — fetch from `/api/v1/csrf` if not cached
3. **Extract object** — `extractObject()` isolates single definition from CSN
4. **Build URL** — `buildDatasphereUrl()` constructs full URL with query params
5. **POST** — send CSN payload as JSON body with auth + CSRF headers
6. **CSRF retry** — if 403, invalidate CSRF cache, fetch new token, retry once
7. **Check response** — `checkResponse()` extracts body text or returns error
8. **Return Result** — success tuple with response body, or error tuple

Login follows a different path: native OAuth authorization code flow via local HTTP callback server.

---

*Last updated: v1.0.0*
