# Catalyst-BDC Documentation

Programmatic Datasphere object management via direct HTTP API.

## Sections

- [Overview](#overview)
- [Getting Started](#getting-started)
- [Writing Scripts](#writing-scripts)
- [BdcClient API](#bdcclient-api)
- [CSN Files](#csn-files)
- [Error Handling](#error-handling)
- [Architecture](#architecture)
- [Additional Docs](#additional-docs)

---

## Overview

Catalyst-BDC is a TypeScript library for automated Datasphere object management. It communicates directly with the Datasphere REST API (no CLI dependency). It handles native OAuth browser login, CSRF token management, automatic token refresh, and CRUD operations for views, local tables, and replication flows.

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
2. Read the CSN file from disk
3. Create a `BdcClient` via `createClient(config)`
4. Call `client.login()` to authenticate (opens browser for OAuth)
5. Call the desired operation (`createView`, `upsertView`, `upsertLocalTable`, etc.)
6. Handle the Result tuple — check the error before using the data

### Full example — uploading a view

```typescript
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { createClient } from '../src';
import type { CsnFile, BdcConfig } from '../src';

const CSN_PATH = 'C:/path/to/my-view.json';
const VIEW_NAME = 'MY_VIEW_NAME';  // must match a key in csn.definitions

const config: BdcConfig = {
    host: process.env['DSP_HOST']!,
    space: process.env['DSP_SPACE']!,
    verbose: true,
    oauth: { optionsFile: './oauth.json' },
};

async function main(): Promise<void> {
    const raw = readFileSync(CSN_PATH, 'utf-8');
    const csn: CsnFile = JSON.parse(raw);

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

    const [result, createErr] = await client.createView(csn, VIEW_NAME);
    if (createErr) {
        console.error('Failed to create view:', createErr.message);
        process.exit(1);
    }

    console.log('View created successfully.');
    console.log(result);
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
| `createView` | `(csn, objectName) => AsyncResult<string>` | Creates a view via POST. |
| `readView` | `(objectName) => AsyncResult<string>` | Reads a view definition via GET. |
| `updateView` | `(csn, objectName) => AsyncResult<string>` | Updates a view via PUT. |
| `deleteView` | `(objectName) => AsyncResult<string>` | Deletes a view via DELETE. |
| `upsertView` | `(csn, objectName) => AsyncResult<UpsertViewResult>` | Creates or updates a view. |
| `createLocalTable` | `(csn, objectName) => AsyncResult<string>` | Creates a local table. |
| `readLocalTable` | `(objectName) => AsyncResult<string>` | Reads a local table definition. |
| `updateLocalTable` | `(csn, objectName) => AsyncResult<string>` | Updates a local table. |
| `deleteLocalTable` | `(objectName) => AsyncResult<string>` | Deletes a local table. |
| `upsertLocalTable` | `(csn, objectName) => AsyncResult<UpsertLocalTableResult>` | Creates or updates a local table. |
| `createReplicationFlow` | `(csn, objectName) => AsyncResult<string>` | Creates a replication flow. |
| `readReplicationFlow` | `(objectName) => AsyncResult<string>` | Reads a replication flow definition. |
| `updateReplicationFlow` | `(csn, objectName) => AsyncResult<string>` | Updates a replication flow. |
| `deleteReplicationFlow` | `(objectName) => AsyncResult<string>` | Deletes a replication flow. |
| `upsertReplicationFlow` | `(csn, objectName) => AsyncResult<UpsertReplicationFlowResult>` | Creates or updates a replication flow. |
| `runReplicationFlow` | `(flowName) => AsyncResult<RunReplicationFlowResult>` | Triggers a replication flow run. |
| `objectExists` | `(objectType, name) => AsyncResult<boolean>` | Checks if an object exists (GET + 200 check). |

All methods return `AsyncResult<T>` which is `Promise<[T, null] | [null, Error]>`.

---

## CSN Files

CSN (Core Schema Notation) files are JSON exports from SAP Datasphere. They contain object definitions.

### Structure

```typescript
interface CsnFile {
    definitions?: Record<string, CsnEntity>;              // views, local tables
    replicationflows?: Record<string, CsnReplicationFlow>; // replication flows
    version?: { csn: string };
    meta?: { creator: string };
    $version?: string;
}
```

- **Views and local tables** are stored under `definitions`. Each key is the object's technical name.
- **Replication flows** are stored under `replicationflows`. Each key is the flow's technical name.
- A CSN file can contain multiple definitions, but the Datasphere API only accepts **one object per request**. The library handles extraction automatically — you pass the full CSN and the object name, and it extracts the single definition before uploading.
- Missing dependencies are allowed — the `allowMissingDependencies=true` query parameter is always set.

---

## Error Handling

The library uses Go-style Result tuples instead of thrown exceptions:

```typescript
type Result<T> = [T, null] | [null, Error];
type AsyncResult<T> = Promise<Result<T>>;
```

Every fallible operation returns a Result. Always check the error before using the data:

```typescript
const [result, error] = await client.createView(csn, 'MyView');
if (error) {
    // error is Error — handle it
    console.error(error.message);
    return;
}
// result is guaranteed non-null here
console.log(result);
```

---

## Architecture

```
src/
├── types/           # Result tuples, BdcConfig (Zod), CSN types, object type registry, requestor
├── core/
│   ├── auth/        # Native OAuth browser flow (performOAuthLogin)
│   ├── csn/         # extractObject, validateCsnFile, resolveDependencies
│   ├── http/        # checkResponse, buildDatasphereUrl, CSRF/token management
│   ├── operations/  # CRUD operations for views, tables, flows (one function per file)
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
