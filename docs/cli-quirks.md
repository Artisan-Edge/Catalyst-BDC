# CLI Quirks & Workarounds

Known gotchas when working with `@sap/datasphere-cli`.

## Sections

- [Programmatic API](#programmatic-api)
- [File Paths](#file-paths)
- [API Constraints](#api-constraints)
- [Replication Flows](#replication-flows)
- [Authentication](#authentication)
- [Delete Operations](#delete-operations)
- [Folder Assignments](#folder-assignments)
- [Compatibility](#compatibility)

---

## Programmatic API

The CLI's Node.js API (`getCommands`) reinitializes internal state and loses auth context. Shell out via `execSync` to `npx datasphere` instead.

---

## File Paths

The CLI joins all option values with spaces then splits on spaces — **file paths with spaces break**. Workaround: copy to a temp file in `os.tmpdir()`.

---

## API Constraints

The Datasphere API only accepts **one object per request**. Multi-definition CSN files must be split before sending.

---

## Replication Flows

Replication flows via CLI do **not** auto-create target local tables (the UI does). Target tables must be created explicitly first. The `createReplicationFlow` operation handles this via the `preDeps` mechanism in `src/types/objectTypes.ts`.

---

## Authentication

- OAuth sessions last **720 hours**
- Passcodes are one-time use
- The `passcode-url` command was removed in CLI v2026.2
- Login requires a two-step process: `datasphere login` then `datasphere config cache init`
- The `config cache init` downloads the discovery document — without it, commands like `objects` are unknown
- Re-running `datasphere login` with an active session prompts for overwrite, which hangs non-interactive processes — check session validity first via `datasphere config cache list`

---

## Delete Operations

- Delete commands use `--technical-name` (not `--file-path`)
- The `--force` flag suppresses confirmation prompts
- Deleting a replication flow before its target local tables avoids dependency errors
- Delete operations can be slow (60+ seconds per object)

---

## Folder Assignments

- Folder IDs (e.g. `Folder_VJHFMFLE`) are set via `_meta.dependencies.folderAssignment` in CSN
- Folder assignment is **write-only** — reading an object back does not return its folder
- There is no CLI or API endpoint to list folders or resolve folder names to IDs
- Folder IDs must be discovered via the Datasphere UI

---

## Compatibility

Node.js v25 is unsupported by the CLI but works with warnings.

---

*Last updated: v0.1.0*
