# Catalyst-BDC Documentation

Programmatic Datasphere object management via direct HTTP API.

## Sections

- [Overview](#overview)
- [Getting Started](#getting-started)
- [Writing Scripts](#writing-scripts)
- [BdcClient API](#bdcclient-api)
- [Data Preview](#data-preview)
- [CSN Files](#csn-files)
- [Error Handling](#error-handling)
- [Architecture](#architecture)
- [Additional Docs](#additional-docs)

---

## Overview

Catalyst-BDC is a TypeScript library for automated Datasphere object management. It communicates directly with the Datasphere REST API (no CLI dependency). It handles native OAuth browser login, CSRF token management, automatic token refresh, and import/read/delete operations for views, local tables, replication flows, and analytic models.

All write operations use the `/deepsea/repository/` import API — the same endpoint the Datasphere UI uses. This supports multi-definition CSN files in a single request, handles circular references between objects, and automatically deploys after import.

---

## Getting Started

```bash
npm install
cp .env.template .env        # fill in DSP_HOST and DSP_SPACE
```

An `oauth.json` file is required for authentication. It must be present in the project root and contain the OAuth client credentials for the Datasphere tenant.

### Authentication Options

**Browser login (interactive):**
```typescript
const [tokens, loginErr] = await client.login();
// Opens a browser, receives OAuth callback, stores tokens
```

**Pre-provided tokens (CI/headless):**
```typescript
const [client, err] = createClient({
    host, space,
    oauth: { optionsFile: './oauth.json' },
    tokens: {
        accessToken: '...',
        refreshToken: '...',
        tokenUrl: '...',
        clientId: '...',
        clientSecret: '...',
    },
});
// No login() needed — operations work immediately
```

---

## Writing Scripts

Scripts live in `scripts/` and are run with `bun`:

```bash
bun scripts/myScript.ts
```

A script follows this pattern:

1. Import `dotenv/config` to load `.env` variables
2. Read the CSN file(s) from disk
3. Create a `BdcClient` via `createClient(config)`
4. Call `client.login()` to authenticate (opens browser for OAuth)
5. Call `client.importCsn(csn)` to import and deploy
6. Handle the Result tuple — check the error before using the data

### Full example — importing views

```typescript
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { createClient } from '../src';
import type { CsnFile, BdcConfig } from '../src';

const config: BdcConfig = {
    host: process.env['DSP_HOST']!,
    space: process.env['DSP_SPACE']!,
    verbose: true,
    oauth: { optionsFile: './oauth.json' },
};

async function main(): Promise<void> {
    const csn: CsnFile = JSON.parse(readFileSync('my-views.json', 'utf-8'));

    const [client, clientErr] = createClient(config);
    if (clientErr) {
        console.error('Failed to create client:', clientErr.message);
        process.exit(1);
    }

    const [, loginErr] = await client.login();
    if (loginErr) {
        console.error('Login failed:', loginErr.message);
        process.exit(1);
    }

    const [result, importErr] = await client.importCsn(csn);
    if (importErr) {
        console.error('Import failed:', importErr.message);
        process.exit(1);
    }

    console.log(`Imported ${result.objectIds.length} objects.`);
}

main();
```

---

## BdcClient API

Create a client with `createClient(config)`. Returns a `Result<BdcClient>` tuple.

### Configuration

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

### Methods

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
| `getViewColumns` | `(viewName) => AsyncResult<ViewColumn[]>` | Fetches column metadata (name, type, key) from a view's OData `$metadata`. |

All methods return `AsyncResult<T>` which is `Promise<[T, null] | [null, Error]>`.

---

## Data Preview

Query data from deployed views and local tables via OData. Views must have an "Active" deployment status.

### Getting column metadata

Use `getViewColumns` to discover available columns before querying:

```typescript
const [columns, colErr] = await client.getViewColumns('MY_VIEW');
if (colErr) { console.error(colErr.message); return; }

for (const col of columns) {
    console.log(`${col.name} (${col.type})${col.isKey ? ' [KEY]' : ''}`);
}
```

Each `ViewColumn` contains:

| Field | Type | Description |
|-------|------|-------------|
| `name` | `string` | Column name (e.g. `COMPANYCODE`) |
| `type` | `string` | OData type (e.g. `Edm.String`, `Edm.Decimal`) |
| `maxLength` | `number \| null` | Max string length |
| `precision` | `number \| null` | Decimal precision |
| `scale` | `number \| null` | Decimal scale |
| `isKey` | `boolean` | Whether the column is part of the entity key |

### Fetching rows

```typescript
const [result, previewErr] = await client.previewData('MY_VIEW', {
    top: 100,       // max rows to return (default: 200)
    skip: 0,        // offset for pagination (default: 0)
});
if (previewErr) { console.error(previewErr.message); return; }

console.log(`Got ${result.rows.length} rows`);
for (const row of result.rows) {
    console.log(row);  // Record<string, unknown>
}
```

### Selecting specific columns

```typescript
const [result, err] = await client.previewData('MY_VIEW', {
    select: ['COMPANYCODE', 'FISCALYEAR', 'AMOUNT'],
    top: 50,
});
```

### Filtering with `$filter`

The `filter` option accepts an OData `$filter` expression string:

```typescript
// Equality
const [result, err] = await client.previewData('MY_VIEW', {
    filter: "COMPANYCODE eq '1010'",
});

// Multiple conditions
const [result, err] = await client.previewData('MY_VIEW', {
    filter: "COMPANYCODE eq '1010' and FISCALYEAR eq '2025'",
});

// Comparisons
const [result, err] = await client.previewData('MY_VIEW', {
    filter: "AMOUNT gt 1000",
});

// Combined with select
const [result, err] = await client.previewData('MY_VIEW', {
    select: ['COMPANYCODE', 'GLACCOUNT', 'AMOUNT'],
    filter: "ACCOUNTINGDOCUMENTTYPE eq 'SA' and FISCALYEAR eq '2025'",
    top: 500,
});
```

Common OData filter operators:

| Operator | Example | Description |
|----------|---------|-------------|
| `eq` | `FIELD eq 'value'` | Equals |
| `ne` | `FIELD ne 'value'` | Not equals |
| `gt` | `FIELD gt 100` | Greater than |
| `ge` | `FIELD ge 100` | Greater than or equal |
| `lt` | `FIELD lt 100` | Less than |
| `le` | `FIELD le 100` | Less than or equal |
| `and` | `A eq '1' and B eq '2'` | Logical AND |
| `or` | `A eq '1' or A eq '2'` | Logical OR |

### DataPreviewResult

```typescript
interface DataPreviewResult {
    rows: Record<string, unknown>[];  // data rows (OData metadata stripped)
    count: number | null;             // total count if available
}
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

## Architecture

```
src/
├── types/           # Result tuples, BdcConfig (Zod), CSN types, object type registry, requestor
├── core/
│   ├── auth/        # Native OAuth browser flow (performOAuthLogin)
│   ├── http/        # checkResponse, buildDatasphereUrl, CSRF/token management
│   ├── operations/  # Read, delete, import, run (one function per file)
│   └── utils/       # debug logging, safe JSON parsing
├── client/          # BdcClient interface + createClient factory (self-referencing DatasphereRequestor)
└── index.ts         # Public barrel exports
```

| Script | Purpose |
|--------|---------|
| `npm run build` | tsup build (ESM + CJS + types) |
| `npm run test` | bun test suite |
| `npm run typecheck` | tsc --noEmit |

---

## Additional Docs

| Document | Description |
|----------|-------------|
| [architecture.md](./architecture.md) | Module hierarchy, patterns, request lifecycle |
| [references.md](./references.md) | External documentation sources |
| [changelogs/](./changelogs/) | Version history and release notes |

---

*Last updated: v1.0.0*
