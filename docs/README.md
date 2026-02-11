# Catalyst-BDC Documentation

Programmatic Datasphere object creation via `@sap/datasphere-cli`.

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

Catalyst-BDC is a TypeScript library that wraps the SAP Datasphere CLI for automated object management. It handles OAuth login, CSN extraction, dependency resolution, and CRUD operations for views, local tables, and replication flows.

---

## Getting Started

```bash
npm install
cp .env.template .env        # fill in DSP_HOST and DSP_SPACE
```

An `oauth.json` file is required for authentication. It must be present in the project root and contain the OAuth client credentials for the Datasphere tenant.

Before running any script, ensure you have an active OAuth session. Sessions last 720 hours. Run `npm run login` to authenticate (opens a browser).

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
4. Call `client.login()` to ensure an active session
5. Call the desired operation (`createView`, `createLocalTable`, `upsertReplicationFlow`, etc.)
6. Handle the Result tuple — check the error before using the data

### Full example — uploading a view

```typescript
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { createClient } from '../src/client';
import type { CsnFile } from '../src/types/csn';
import type { BdcConfig } from '../src/types/config';

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

### Uploading a replication flow (with dependencies)

Replication flows require their target local tables to exist first. `upsertReplicationFlow` handles this automatically — it resolves dependency table names from the CSN, creates or updates each one, then creates or updates the flow itself.

```typescript
const FLOW_NAME = 'MY_REPLICATION_FLOW';  // must match a key in csn.replicationflows

const [result, flowErr] = await client.upsertReplicationFlow(csn, FLOW_NAME);
if (flowErr) {
    console.error('Failed:', flowErr.message);
    process.exit(1);
}

// result.depOutputs — array of { name, output, action } for each dependency table
// result.flowOutput — CLI output for the flow itself
// result.flowAction — 'created' | 'updated'
// result.runResult  — present if the flow was run after upsert (default: true)
```

Pass `false` as the third argument to skip running the flow after upsert:

```typescript
await client.upsertReplicationFlow(csn, FLOW_NAME, false);
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
    oauth?:             // OAuth credentials — either inline or file reference
        | { clientId: string; clientSecret: string; authorizationUrl: string; tokenUrl: string }
        | { optionsFile: string };
}
```

`host` and `space` are typically read from environment variables (`DSP_HOST`, `DSP_SPACE`).

### Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `login` | `() => AsyncResult<void>` | Ensures an active OAuth session. Opens a browser if needed. |
| `createView` | `(csn, objectName) => AsyncResult<string>` | Creates a view. The `objectName` must be a key in `csn.definitions`. |
| `createLocalTable` | `(csn, objectName) => AsyncResult<string>` | Creates a local table. The `objectName` must be a key in `csn.definitions`. |
| `upsertReplicationFlow` | `(csn, objectName, runFlowAfter?) => AsyncResult<ReplicationFlowResult>` | Creates or updates a replication flow and its dependency local tables. Runs the flow after by default. |
| `runReplicationFlow` | `(flowName) => AsyncResult<RunReplicationFlowResult>` | Runs an existing replication flow via HTTP API. |
| `deleteObject` | `(objectType, technicalName) => AsyncResult<string>` | Deletes an object. `objectType` is `'view'`, `'local-table'`, or `'replication-flow'`. |

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
- Dependency references (e.g. a view referencing `I_LANGUAGE`) don't need to be uploaded — the `--allow-missing-dependencies` flag is always set.

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
├── types/           # Result tuples, BdcConfig (Zod), CSN types, object type registry
├── core/
│   ├── cli/         # CliExecutor (execSync wrapper), temp file lifecycle
│   ├── csn/         # extractObject, validateCsnFile, resolveDependencies
│   ├── http/        # OAuth token management, CSRF token fetching
│   ├── operations/  # login, createView, createLocalTable, upsertReplicationFlow, deleteObject, runReplicationFlow
│   └── utils/       # debug logging, safe JSON parsing
├── client/          # BdcClient interface + createClient factory
└── index.ts         # Public barrel exports
```

| Script | Purpose |
|--------|---------|
| `npm run build` | tsup build (ESM + CJS + types) |
| `npm run test` | bun test suite |
| `npm run typecheck` | tsc --noEmit |
| `npm run login` | OAuth login to Datasphere tenant |

---

## Additional Docs

| Document | Description |
|----------|-------------|
| [architecture.md](./architecture.md) | Module hierarchy, patterns, request lifecycle |
| [cli-quirks.md](./cli-quirks.md) | Known CLI gotchas and workarounds |
| [cli-commands.md](./cli-commands.md) | Object types and command options |
| [references.md](./references.md) | External documentation sources |
| [changelogs/](./changelogs/) | Version history and release notes |

---

*Last updated: v0.1.0*
