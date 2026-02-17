# Catalyst-BDC

Programmatic Datasphere object management via direct HTTP API.

**USE /write-typescript skill before modifying any code always**

## Architecture

Layered TypeScript library: `types → core → client`

```
src/
├── types/          # Result tuples, BdcConfig (Zod), CSN types, object type registry, DatasphereRequestor
├── core/
│   ├── auth/       # Native OAuth browser flow (performOAuthLogin)
│   ├── csn/        # extractObject, validateCsnFile, resolveDependencies
│   ├── http/       # checkResponse, buildDatasphereUrl, CSRF/token management
│   ├── operations/ # CRUD for views, tables, flows (one function per file)
│   └── utils/      # debug logging, safe JSON parsing
├── client/         # BdcClient interface + createClient factory (self-referencing DatasphereRequestor)
└── index.ts        # Public barrel exports
```

## Module Conventions

- **One function per file** in core/operations and core/csn
- **Result tuples** (`[T, null] | [null, Error]`) for all fallible operations — no thrown exceptions
- **Barrel exports** (`index.ts`) at every directory level
- **Import hierarchy**: `types ← core/utils ← core/auth ← core/http ← core/csn ← core/operations ← client` — no cycles
- **DatasphereRequestor pattern**: Operations receive a `DatasphereRequestor` interface (not raw fetch). The client implements it via `{ request: this.request.bind(this) }` with auto token refresh + CSRF retry.

## Testing Rules

- **No mocking, ever.** All tests run against real functions and real services.
- Integration tests hit the real Datasphere HTTP API — requires OAuth login
- Tests read `DSP_HOST` and `DSP_SPACE` from environment (`.env` via dotenv)
- Pure logic tests (CSN extraction, validation) use real fixture data from `src/__tests__/assets/`

## Documentation

- **[docs/README.md](../docs/README.md)** — Full library documentation
- **[docs/architecture.md](../docs/architecture.md)** — Module hierarchy, patterns, request lifecycle
- **[docs/references.md](../docs/references.md)** — External documentation sources
- **[PLAN.md](../PLAN.md)** — Objectives tracking and architecture decisions

## Type Safety Rules

- **Never `as` cast external data.** HTTP responses and parsed JSON must be validated with a Zod schema — no exceptions.
- **`safeJsonParse(text, schema)`** requires a Zod schema and returns `Result<T>`. Never parse JSON without declaring the expected shape.
- **Never use `response.json()`** — it returns `any`. Use `response.text()` + `safeJsonParse(body, schema)`.
- **No manual type guards.** Use Zod schemas instead of hand-rolled `typeof` checks + `as` casts.
- **Zod generic parameter pattern:** Use `<S extends z.ZodTypeAny>(schema: S): z.infer<S>`, not `<T>(schema: z.ZodType<T>): T` — the latter breaks inference with `z.preprocess`/`z.effects`.

## Quick Reminders

- All CRUD goes through direct HTTP — no CLI dependency
- API accepts **one object per request** — split multi-definition CSN files
- Replication flows don't auto-create target local tables — create them first
- CSRF tokens are fetched from `/api/v1/csrf` and auto-retried on 403
- Access tokens are auto-refreshed when expired
- `TokenConfig` in BdcConfig allows headless/CI usage without browser login
- Build: `tsup` (ESM + CJS + types) — Test: `bun test` — Typecheck: `tsc --noEmit`

## Using the Library
Read `docs/README.md` when asked to use the library, instead of re-exploring the codebase.
