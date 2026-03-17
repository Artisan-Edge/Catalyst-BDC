# Catalyst-BDC Documentation

Programmatic Datasphere object management via direct HTTP API.

## Sections

- [Overview](#overview)
- [Getting Started](#getting-started)
- [Writing Scripts](#writing-scripts)
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

## Architecture

```
src/
├── types/           # Result tuples, BdcConfig (Zod), CSN types, object type registry, requestor
├── core/
│   ├── auth/        # Native OAuth browser flow (performOAuthLogin)
│   ├── http/        # checkResponse, buildDatasphereUrl, CSRF/token management
│   ├── operations/  # Read, delete, import, run, navigator (one function per file)
│   └── utils/       # debug logging, safe JSON parsing
├── ina/             # [EXPERIMENTAL] INA protocol — analytic model queries
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
| [api.md](./api.md) | BdcClient API reference, configuration, error handling, CSN files |
| [navigator.md](./navigator.md) | Space browsing, data preview, OData filtering |
| [ina.md](./ina.md) | INA protocol for analytic model queries (experimental) |
| [architecture.md](./architecture.md) | Module hierarchy, patterns, request lifecycle |
| [references.md](./references.md) | External documentation sources |
| [changelogs/](./changelogs/) | Version history and release notes |

---

*Last updated: v0.2.1*
