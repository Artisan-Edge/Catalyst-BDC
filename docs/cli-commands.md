# CLI Object Types & Commands

Available Datasphere CLI object types and shared command options.

## Sections

- [Object Types](#object-types)
- [Common Create Options](#common-create-options)
- [Common Delete Options](#common-delete-options)

---

## Object Types

From `datasphere objects --help`:

| Category | Types |
|----------|-------|
| **Tables** | remote-tables, local-tables |
| **Models** | er-models, analytic-models, fact-models, consumption-models |
| **Views** | views |
| **Flows** | task-chains, data-flows, replication-flows, transformation-flows |
| **Security** | data-access-controls |
| **Semantic** | business-entities, intelligent-lookups |
| **Ontology** | ontologies, contexts, types, services |

---

## Common Create Options

All `objects <type> create` commands share these options:

| Option | Description |
|--------|-------------|
| `--space <space>` | Target space ID |
| `--file-path <path>` | CSN JSON file |
| `--input <string>` | CSN as inline string (alternative to file-path) |
| `--allow-missing-dependencies` | Create even if dependencies are absent |
| `--no-deploy` | Save without deploying |
| `--save-anyway` | Save even with validation warnings |
| `--verbose` | Detailed output |

---

## Common Delete Options

All `objects <type> delete` commands share these options:

| Option | Description |
|--------|-------------|
| `--space <space>` | Target space ID |
| `--technical-name <name>` | Technical name of the object to delete |
| `--force` | Suppress confirmation prompts |
| `--delete-anyway` | Force deletion even if other objects depend on it |
| `--verbose` | Detailed output |

---

*Last updated: v0.1.0*
