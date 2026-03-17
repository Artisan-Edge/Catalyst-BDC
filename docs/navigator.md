# Navigator and Data Preview

Browse space contents and query live data from deployed views and tables.

## Sections

- [Listing Objects](#listing-objects)
- [Searching Objects](#searching-objects)
- [Listing Folders](#listing-folders)
- [Column Metadata](#column-metadata)
- [Fetching Rows](#fetching-rows)
- [Filtering with OData](#filtering-with-odata)

---

## Listing Objects

```typescript
const [objects, listErr] = await client.listObjects({
    kind: 'relational_dataset',      // filter by object kind
    namePattern: 'I_*Replication',   // glob pattern on names
    excludeFolders: true,            // exclude folder objects
});
if (listErr) { console.error(listErr.message); return; }

for (const obj of objects) {
    console.log(`${obj.technicalName} (${obj.kind}) — ${obj.deploymentStatus}`);
}
```

Auto-paginates in batches of 500. Supports filtering by `DesignObjectKind` and glob patterns on names.

---

## Searching Objects

```typescript
const [result, searchErr] = await client.searchObjects({
    queryText: 'accounts payable',
    kind: 'analytic_model',
    top: 10,
});
```

---

## Listing Folders

```typescript
const [folders, folderErr] = await client.listFolders();          // root folders
const [sub, subErr] = await client.listFolders(parentFolderId);   // subfolder drill-down
```

---

## Column Metadata

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

---

## Fetching Rows

Views must have an "Active" deployment status to be queryable.

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

### DataPreviewResult

```typescript
interface DataPreviewResult {
    rows: Record<string, unknown>[];  // data rows (OData metadata stripped)
    count: number | null;             // total count if available
}
```

---

## Filtering with OData

The `filter` option accepts an OData `$filter` expression string:

```typescript
const [result, err] = await client.previewData('MY_VIEW', {
    select: ['COMPANYCODE', 'GLACCOUNT', 'AMOUNT'],
    filter: "COMPANYCODE eq '1010' and FISCALYEAR eq '2025'",
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

---

*Last updated: v0.2.1*
