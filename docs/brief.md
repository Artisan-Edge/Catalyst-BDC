# INA Module Brief

## What Was Done

Added an experimental `src/ina/` module that queries SAP Datasphere analytic models via the INA (Information Access) protocol — the same undocumented protocol SAP Analytics Cloud uses internally.

## Key Technical Findings

The INA protocol on Datasphere cloud required extensive reverse-engineering:

- **Endpoint**: POST to `/dwaas-core/sap/bc/ina/service/v2/GetResponse`
- **CSRF**: Must be fetched from `/sap/bc/ina/service/v2/GetServerInfo` via GET with `x-csrf-token: Fetch` header. The standard Datasphere CSRF from `/api/v1/csrf` does NOT work for INA.
- **DataSource type**: `InAModel` (not `CALC`, `INAMODEL`, or `Catalog`)
- **InstanceId**: A UUID is required (e.g., `003b6f9b-ade8-5199-4dff-9958a5c0350a` for ZSNAP_F01S_Q01). This appears to be a model-specific identifier. Currently hardcoded in the probe script — needs a discovery mechanism.
- **Capabilities**: The full SAC capabilities array (~190 strings) must be declared in every request. Missing any required capability causes the server to reject the query.
- **Variables**: Analytic models have input parameters (P_DISPLAYCURRENCY, P_KEYDATE, etc.) that must be passed as `Variables` in the request.
- **Response format**: Version2 uses encoded arrays (`{ Encoding: "None", Values: [...] }`) rather than simple arrays. The `queryData` operation flattens this into simple row objects.

## Files Created/Modified

```
src/ina/
├── types.ts           # Capabilities list, Zod schemas, request/response types
├── fetchInaCsrf.ts    # INA-specific CSRF token fetch
├── getServerInfo.ts   # GET server info (connectivity check)
├── getMetadata.ts     # Model metadata (dimensions/measures)
├── queryData.ts       # Data queries with V2 grid flattening
└── index.ts           # Barrel exports

src/client/client.ts   # Added inaGetServerInfo, inaGetMetadata, inaQueryData
src/index.ts           # Added INA re-exports
scripts/ina-probe.ts   # Working test script against ZSNAP_F01S_Q01
```

Exploration scripts (`scripts/ina-explore*.ts`, `scripts/ina-real-test*.ts`) can be deleted — they were used for endpoint discovery.

## What Works

```
bun scripts/ina-probe.ts
```

Returns real data from ZSNAP_F01S_Q01 (Open Accounts Payable Aging):
- Company Code 1000: $1,143,326.62 (19 rows)
- Company Code 1500: $15,300.00 (7 rows)

## Open Issues

1. **InstanceId discovery** — Currently hardcoded. Need a way to look up the UUID for a given model name. May require inspecting Datasphere's internal API or the search/design object endpoints.
2. **Analytic models vs cube views** — Direct analytic model queries (`Type: InAModel`) require the InstanceId. Cube views (`Type: CALC`) work without it but require parameter placeholders.
3. **Variable discovery** — No programmatic way to discover which variables a model requires and their valid values. Currently derived from the CSN definition and SAC captures.
4. **Auth scope** — Analytic models returned "Not authorized" via the HANA-level INA path (`/sap/bc/ina/`). Only the Datasphere proxy path (`/dwaas-core/sap/bc/ina/`) works for `InAModel` types.
5. **Cleanup** — Delete the `scripts/ina-explore*.ts` and `scripts/ina-real-test*.ts` exploration scripts.
