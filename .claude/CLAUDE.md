# Catalyst-BDC

Programmatic Datasphere object creation via `@sap/datasphere-cli`.

**USE /write-typescript skill before modifying any code always**

## Architecture

Layered TypeScript library: `types → core → client`

```
src/
├── types/          # Result tuples, BdcConfig (Zod), CSN types, object type registry
├── core/
│   ├── cli/        # CliExecutor (wraps execSync), temp file lifecycle
│   ├── csn/        # extractObject, validateCsnFile, resolveDependencies
│   ├── operations/ # createView, createLocalTable, createReplicationFlow
│   └── utils/      # debug logging
├── client/         # BdcClient interface + createClient factory
└── index.ts        # Public barrel exports
```

## Module Conventions

- **One function per file** in core/operations and core/csn
- **Result tuples** (`[T, null] | [null, Error]`) for all fallible operations — no thrown exceptions
- **Barrel exports** (`index.ts`) at every directory level
- **Import hierarchy**: `types ← core/utils ← core/cli ← core/csn ← core/operations ← client` — no cycles

## Testing Rules

- **No mocking, ever.** All tests run against real functions and real services.
- Integration tests hit the real Datasphere CLI — requires an active OAuth session (`npm run login`)
- Tests read `DSP_HOST` and `DSP_SPACE` from environment (`.env` via dotenv)
- Pure logic tests (CSN extraction, validation) use real fixture data from `src/__tests__/assets/`

## Documentation

- **[docs/cli-quirks.md](../docs/cli-quirks.md)** — CLI gotchas (file paths, auth, API limits)
- **[docs/references.md](../docs/references.md)** — External documentation sources
- **[docs/cli-commands.md](../docs/cli-commands.md)** — Object types and command options
- **[PLAN.md](../PLAN.md)** — Objectives tracking and architecture decisions

## Type Safety Rules

- **Never `as` cast external data.** CLI output, HTTP responses, and parsed JSON must be validated with a Zod schema — no exceptions.
- **`safeJsonParse(text, schema)`** requires a Zod schema and returns `Result<T>`. Never parse JSON without declaring the expected shape.
- **Never use `response.json()`** — it returns `any`. Use `response.text()` + `safeJsonParse(body, schema)`.
- **No manual type guards.** Use Zod schemas instead of hand-rolled `typeof` checks + `as` casts.
- **Zod generic parameter pattern:** Use `<S extends z.ZodTypeAny>(schema: S): z.infer<S>`, not `<T>(schema: z.ZodType<T>): T` — the latter breaks inference with `z.preprocess`/`z.effects`.

## Quick Reminders

- Shell out via `execSync` to `npx datasphere` — the programmatic API loses auth context
- File paths with spaces break the CLI — use temp files in `os.tmpdir()`
- API accepts **one object per request** — split multi-definition CSN files
- Replication flows don't auto-create target local tables — create them first
- OAuth sessions last 720 hours; passcodes are one-time use
- Build: `tsup` (ESM + CJS + types) — Test: `bun test` — Typecheck: `tsc --noEmit`

## Using the Library
Read `docs/README.md` when asked to use the library, instead of re-exploring the codebase.
