# Architecture

Layered TypeScript library wrapping `@sap/datasphere-cli` for programmatic object management.

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
│   ├── config.ts        # BdcConfig, OAuthConfig + Zod schemas
│   ├── csn.ts           # CsnFile, CsnEntity, CsnReplicationFlow
│   ├── objectTypes.ts   # DSP_OBJECT_TYPES registry, DspObjectType
│   └── index.ts
├── core/
│   ├── utils/           # Debug logging (leaf — no internal imports)
│   │   └── logging.ts
│   ├── cli/             # Shell execution layer
│   │   ├── executor.ts  # CliExecutor: wraps execSync, returns Result
│   │   └── tempFile.ts  # writeTempCsn / cleanupTempFile
│   ├── csn/             # CSN file manipulation
│   │   ├── extract.ts   # extractObject() — isolates single object from CSN
│   │   ├── validate.ts  # validateCsnFile() — structural checks
│   │   └── resolveDeps.ts  # resolveDependencies() — pre-dep names
│   ├── operations/      # Business logic (one function per file)
│   │   ├── login.ts     # OAuth login + cache init
│   │   ├── createView.ts
│   │   ├── createLocalTable.ts
│   │   ├── createReplicationFlow.ts  # Orchestrates deps + flow
│   │   └── deleteObject.ts
│   └── index.ts
├── client/              # Public API surface
│   ├── types.ts         # ClientContext (internal)
│   ├── client.ts        # BdcClient interface + BdcClientImpl
│   └── index.ts         # createClient() factory
└── index.ts             # Root barrel — public exports only
```

---

## Import Rules

Strict hierarchy — no circular dependencies:

```
types/            ← zod only
core/utils/       ← (leaf)
core/cli/         ← types/, core/utils/
core/csn/         ← types/
core/operations/  ← types/, core/cli/, core/csn/, core/utils/
client/           ← types/, core/operations/, core/cli/, core/utils/
index.ts          ← client/, types/, core/operations/
```

---

## Key Patterns

### Result Tuples

All fallible operations return `Result<T, Error>` — no thrown exceptions:

```typescript
type Result<T, E extends Error = Error> = [T, null] | [null, E];

const [data, error] = await client.createView(csn, 'MyView');
if (error) { /* handle */ }
// data is guaranteed non-null
```

### One Function Per File

Each file in `core/operations/` and `core/csn/` exports a single function. This keeps each operation independently importable and testable.

### Barrel Exports

Every directory has an `index.ts` that re-exports its contents. Consumers import from directory paths, never from specific files.

---

## BdcClient API

```typescript
interface BdcClient {
    readonly config: BdcConfig;
    login(): AsyncResult<void>;
    createView(csn: CsnFile, objectName: string): AsyncResult<string>;
    createLocalTable(csn: CsnFile, objectName: string): AsyncResult<string>;
    createReplicationFlow(csn: CsnFile, objectName: string): AsyncResult<ReplicationFlowResult>;
    deleteObject(objectType: DeletableObjectType, technicalName: string): AsyncResult<string>;
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
    verbose?: boolean;     // CLI --verbose flag
    oauth?: OAuthConfig | { optionsFile: string };
}
```

OAuth accepts either inline credentials or a path to a JSON options file matching the CLI's `--options-file` format.

---

## Request Lifecycle

A typical `createReplicationFlow` call:

1. **Resolve dependencies** — `resolveDeps.ts` reads `flow.targets` to find local table names
2. **Extract objects** — `extract.ts` isolates each object into a single-definition CSN
3. **Write temp file** — `tempFile.ts` writes CSN to `os.tmpdir()` (avoids CLI space-in-path bug)
4. **Execute CLI** — `executor.ts` runs `npx datasphere objects <type> create --file-path <tmp> ...`
5. **Cleanup** — temp file deleted in `finally` block
6. **Return Result** — success tuple with CLI output, or error tuple

Login follows a different path: `spawn` (not `execSync`) for the interactive OAuth browser flow, then `execSync` for cache initialization.

---

*Last updated: v0.1.0*
