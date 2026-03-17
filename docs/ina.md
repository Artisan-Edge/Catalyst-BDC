# INA Protocol (Experimental)

Query SAP Datasphere analytic models via the INA (Information Access) protocol — the same undocumented protocol SAP Analytics Cloud uses internally.

## Sections

- [Prerequisites](#prerequisites)
- [Server Connectivity](#server-connectivity)
- [Model Metadata](#model-metadata)
- [Querying Data](#querying-data)
- [Open Issues](#open-issues)

---

## Prerequisites

- The INA protocol uses its own CSRF token (fetched from `/sap/bc/ina/service/v2/GetServerInfo`). The client handles this automatically.
- Analytic model queries require an `InstanceId` (a model-specific UUID). Discovery of this ID is not yet automated.
- The full SAC capabilities array (~190 strings) is declared in every request automatically.

---

## Server Connectivity

```typescript
const [info, infoErr] = await client.inaGetServerInfo();
if (infoErr) { console.error(infoErr.message); return; }

console.log(`${info.serverType} v${info.version}, ${info.capabilities.length} capabilities`);
```

---

## Model Metadata

```typescript
const dataSource: InaDataSource = {
    ObjectName: 'ZSNAP_F01S_Q01',
    SchemaName: 'MYSPACE',
    Type: 'InAModel',
    InstanceId: '003b6f9b-ade8-5199-4dff-9958a5c0350a',
};

const [meta, metaErr] = await client.inaGetMetadata(dataSource);
if (metaErr) { console.error(metaErr.message); return; }

for (const dim of meta.dimensions) {
    console.log(`Dimension: ${dim.name} — ${dim.attributes.length} attributes`);
}
console.log(`Measures: ${meta.measures.join(', ')}`);
```

`InaMetadataResult` contains:

| Field | Type | Description |
|-------|------|-------------|
| `dimensions` | `InaDimensionInfo[]` | Dimension names, types, and attributes |
| `measures` | `string[]` | Available measure names |
| `variables` | `string[]` | Input variable names |
| `raw` | `unknown` | Full parsed INA response for debugging |

---

## Querying Data

```typescript
const [result, queryErr] = await client.inaQueryData({
    dataSource,
    dimensions: [
        { Name: 'CompanyCode', Axis: 'Rows' },
    ],
    measures: ['AmountInDisplayCurrency'],
    variables: [
        { Name: 'P_DISPLAYCURRENCY', SimpleStringValues: ['USD'] },
        { Name: 'P_KEYDATE', SimpleStringValues: ['2026-03-17'] },
    ],
    rowLimit: 200,
});
if (queryErr) { console.error(queryErr.message); return; }

console.log(`${result.rows.length} rows (${result.totalRows} total)`);
for (const row of result.rows) {
    console.log(row);  // { CompanyCode: '1000', AmountInDisplayCurrency: 1143326.62, ... }
}
```

### InaQueryOptions

| Field | Type | Description |
|-------|------|-------------|
| `dataSource` | `InaDataSource` | Model name, schema, type, and optional InstanceId |
| `dimensions` | `InaDimensionRequest[]` | Dimensions to place on rows/columns axes |
| `measures` | `string[]` | Measure names to include |
| `variables` | `InaVariable[]` | Input parameter values (e.g. currency, key date) |
| `filter` | `InaFilterSelection` | Dynamic filter on dimension members |
| `rowLimit` | `number` | Max rows (default: 200) |
| `columnLimit` | `number` | Max columns (default: 50) |

### InaQueryResult

| Field | Type | Description |
|-------|------|-------------|
| `rows` | `InaCellRow[]` | Flattened row objects mapping dimension/measure names to values |
| `totalRows` | `number` | Total row count from server |
| `totalColumns` | `number` | Total column count from server |
| `units` | `Record<string, string>` | Measure-to-unit mapping (e.g. `{ AmountInDisplayCurrency: 'USD' }`) |
| `raw` | `unknown` | Full parsed INA response for debugging |

---

## Open Issues

1. **InstanceId discovery** — Currently hardcoded per model. Needs a lookup mechanism.
2. **Variable discovery** — No programmatic way to discover required variables and valid values.
3. **Auth scope** — Only the Datasphere proxy path (`/dwaas-core/sap/bc/ina/`) works; the HANA-level path returns "Not authorized".

---

*Last updated: v0.2.1*
