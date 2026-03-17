# INA Protocol (Experimental)

Query SAP Datasphere analytic models via the INA (Information Access) protocol — the same undocumented protocol SAP Analytics Cloud uses internally.

## Sections

- [End-to-End Workflow](#end-to-end-workflow)
- [Model Discovery](#model-discovery)
- [Simplified Query](#simplified-query)
- [Low-Level API](#low-level-api)
- [Open Issues](#open-issues)

---

## End-to-End Workflow

```typescript
// 1. Discover models (knowing nothing)
const [models] = await client.inaListModels();
// → [{ name: 'ZSNAP_F01S_Q01', businessName: 'Open AP Aging', ... }, ...]

// 2. Query with minimal config — just model name, columns, measures, and variables
const [result] = await client.inaQuery({
    model: 'ZSNAP_F01S_Q01',
    columns: ['COMPANYCODE'],
    measures: ['AMOUNTINDISPLAYCURRENCY', 'NUMBEROFROWS'],
    variables: {
        P_DISPLAYCURRENCY: 'USD',
        P_KEYDATE: '2026-03-17',
        P_NETDUEINTERVAL1INDAYS: 30,
    },
});
// → { rows: [{ COMPANYCODE: '1000', AMOUNTINDISPLAYCURRENCY: 1143326.62, ... }], ... }
```

No InstanceId, no dimension boilerplate, no variable format gymnastics.

---

## Model Discovery

List all analytic models in the space.

```typescript
const [models, err] = await client.inaListModels();
if (err) { console.error(err.message); return; }

for (const model of models) {
    console.log(`${model.name} — ${model.businessName ?? '(no description)'}`);
}

// Filter by glob pattern
const [filtered] = await client.inaListModels({ pattern: 'ZSNAP_*' });
```

### InaModelEntry

| Field | Type | Description |
|-------|------|-------------|
| `name` | `string` | Technical name |
| `businessName` | `string \| null` | Human-readable name |
| `description` | `string \| null` | Description |
| `instanceId` | `string` | Search API object ID |

---

## Simplified Query

Run a query with minimal configuration. Dimension boilerplate (`ReadMode`, `ResultStructure`) is added automatically. Variables are passed as simple key-value pairs.

```typescript
const [result, err] = await client.inaQuery({
    model: 'ZSNAP_F01S_Q01',
    columns: ['COMPANYCODE'],
    measures: ['AMOUNTINDISPLAYCURRENCY', 'NUMBEROFROWS'],
    variables: {
        P_DISPLAYCURRENCY: 'USD',
        P_EXCHANGERATETYPE: 'M',
        P_KEYDATE: '2026-03-17',
        P_NETDUEINTERVAL1INDAYS: 30,
        P_NETDUEINTERVAL2INDAYS: 60,
        P_NETDUEINTERVAL3INDAYS: 90,
        P_NETDUEINTERVAL4INDAYS: 0,
    },
    limit: 50,
});
if (err) { console.error(err.message); return; }

console.log(`${result.rows.length} rows (${result.totalRows} total)`);
for (const row of result.rows) {
    console.log(row);
}
```

### InaSimpleQueryOptions

| Field | Type | Description |
|-------|------|-------------|
| `model` | `string` | Model technical name |
| `columns` | `string[]?` | Dimension names for row grouping |
| `measures` | `string[]?` | Measure names |
| `variables` | `Record<string, string \| number>?` | Variable values as simple key-value pairs |
| `filter` | `InaFilterSelection?` | Dynamic filter |
| `limit` | `number?` | Row limit (default: 200) |

### InaQueryResult

| Field | Type | Description |
|-------|------|-------------|
| `rows` | `InaCellRow[]` | Flattened row objects mapping dimension/measure names to values |
| `totalRows` | `number` | Total row count from server |
| `totalColumns` | `number` | Total column count from server |
| `units` | `Record<string, string>` | Measure-to-unit mapping (e.g. `{ AmountInDisplayCurrency: 'USD' }`) |
| `raw` | `unknown` | Full parsed INA response for debugging |

---

## Low-Level API

For full control over the INA request format (e.g., variables that require `SetOperand` syntax), use the low-level methods.

### Server Connectivity

```typescript
const [info, err] = await client.inaGetServerInfo();
console.log(`${info.serverType} v${info.version}, ${info.capabilities.length} capabilities`);
```

### Metadata

```typescript
const [meta, err] = await client.inaGetMetadata(
    { ObjectName: 'ZSNAP_F01S_Q01', SchemaName: 'MYSPACE', Type: 'InAModel' },
    [{ Name: 'P_KEYDATE', SimpleStringValues: ['2026-03-17'] }],
);
```

### Raw Query

```typescript
const [result, err] = await client.inaQueryData({
    dataSource: { ObjectName: 'ZSNAP_F01S_Q01', SchemaName: 'MYSPACE', Type: 'InAModel' },
    dimensions: [{ Name: 'COMPANYCODE', Axis: 'Rows', ReadMode: 'BookedAndSpaceAndState' }],
    measures: ['AMOUNTINDISPLAYCURRENCY'],
    variables: [
        { Name: 'P_DISPLAYCURRENCY', SimpleStringValues: ['USD'] },
        {
            Name: 'P_SIGNAGE',
            Values: {
                Selection: {
                    SetOperand: {
                        Elements: [{ Comparison: '=', Low: 'R' }],
                        FieldName: '[ZSNAP_F01C_P_SIGNAGE_»E_P_SIGNAGE].[ZSNAP_F01C_P_SIGNAGE_»E_P_SIGNAGE]',
                    },
                },
            },
        },
    ],
    rowLimit: 200,
});
```

---

## Open Issues

1. **Auth scope** — Only the Datasphere proxy path (`/dwaas-core/sap/bc/ina/`) works; the HANA-level path returns "Not authorized".
2. **Variable discovery** — The INA protocol does not expose variable definitions or defaults. Variable names and types must be known in advance (e.g., from SAP Analytics Cloud documentation or network captures).
3. **SetOperand variables** — Some variables (e.g., `P_SIGNAGE`) require the `Values.Selection.SetOperand` format and cannot be set via `SimpleStringValues`. Use the low-level `inaQueryData` API for these.

---

*Last updated: v0.3.0*
