import { z } from 'zod';

// ---------------------------------------------------------------------------
// INA endpoint configuration
// ---------------------------------------------------------------------------

/** CSRF token is fetched from this path via GET with x-csrf-token: Fetch */
export const INA_CSRF_PATH = '/sap/bc/ina/service/v2/GetServerInfo';

/** GetResponse requests go to the Datasphere INA proxy */
export const INA_GET_RESPONSE_PATH = '/dwaas-core/sap/bc/ina/service/v2/GetResponse';

/** GetServerInfo for connectivity/capability checks */
export const INA_GET_SERVER_INFO_PATH = '/sap/bc/ina/service/v2/GetServerInfo';

// ---------------------------------------------------------------------------
// Client capabilities — must be declared in every Analytics request.
// Derived from SAC live connection captures.
// ---------------------------------------------------------------------------

export const INA_CAPABILITIES = [
    'AggregationNOPNULL', 'AggregationNOPNULLZERO',
    'AggregationsFirstLastAverageOfDimension',
    'AsyncBatchRequest', 'AsyncBatchRequestHeartbeat',
    'AsyncBlendingBatchRequest', 'AsyncMetadataBatchRequest',
    'AttributeHierarchy', 'AttributeHierarchyHierarchyFields',
    'AttributeHierarchyUniqueFields', 'AttributeValueLookup',
    'AverageCountIgnoreNullZero', 'BlendingTotals',
    'BugFixHierarchyFlatKeys', 'CEScenarioParams',
    'CalculateWithNullCellsUnitType', 'CalculatedDimension',
    'CancelRunningRequests', 'CellValueOperand',
    'ClientCapabilities', 'ClientInfoContextId',
    'Conditions', 'ConditionsWithHiddenMeasures',
    'ConditionsWithVersionDimension', 'CubeBlending',
    'CubeBlendingCustomDimension1NoneAxis', 'CubeBlendingCustomMembers',
    'CubeBlendingMemberSorting', 'CubeBlendingNSubqueries',
    'CubeBlendingOutOfContext', 'CubeBlendingProperties',
    'CubeBlendingReadMode', 'CubeCache',
    'CurrencyTranslation', 'CurrentMemberFilterExtension',
    'CustomDimension1MemberType', 'CustomDimension2',
    'CustomDimension2MemberMetadata', 'CustomDimensionFilterCapabilities',
    'CustomDimensionMemberExecutionStep', 'CustomMemberSortOrder',
    'DataEntryErrorsWithRequestContext', 'DataEntryOnUnbooked',
    'DataSourceTypeQuery', 'DataSourceTypeQueryMetadata',
    'DatasourceAtService', 'DimensionDescription',
    'DimensionKindChartOfAccounts', 'DimensionKindEPMVersion',
    'EPMResponseListSharedVersions',
    'ExceptionAggregationAverageNullInSelectionMember',
    'ExceptionAggregationCountNullInSelectionMember',
    'ExceptionAggregationDimsAndFormulas',
    'ExceptionAggregationFirstLastInSelectionMember',
    'ExceptionSettings', 'Exceptions',
    'ExpandHierarchyBottomUp', 'ExtHierarchy',
    'ExtendedDimensions', 'ExtendedDimensionsChangeDefaultRenamingAndDescription',
    'ExtendedDimensionsCopyAllHierarchies', 'ExtendedDimensionsFieldMapping',
    'ExtendedDimensionsJoinCardinality', 'ExtendedDimensionsJoinColumns',
    'ExtendedDimensionsOuterJoin', 'ExtendedDimensionsSkip',
    'FastPath', 'FilterCapabilityExtended',
    'FixMetaDataHierarchyAttributes', 'FlatKeyOnHierarchicalDisplay',
    'HierarchyAttributePathPresentationType', 'HierarchyCatalog',
    'HierarchyDataAndExcludingFilters', 'HierarchyKeyTextName',
    'HierarchyNavigationDeltaMode', 'HierarchyPath',
    'HierarchyPathUniqueName', 'HierarchyTrapezoidFilter',
    'HierarchyVirtualRootNode', 'IgnoreUnitOfNullValueInAggregation',
    'IgnoreUnitOfZeroValueInAggregation', 'InAModelExternalDimension',
    'InAModelExternalValuehelp', 'InputEnablementFilterSettings',
    'InputReadinessFilter', 'InputReadinessStates',
    'InputReadinessWithNavigationalAttributes', 'IsVirtualDescription',
    'IteratedFormula', 'LightWeightMetadata',
    'ListReporting', 'LocaleSorting',
    'MasterReadModeByDimensionGrouping', 'MaxResultRecords',
    'MdsExpression', 'MeasureMemberCurrencyTranslations',
    'MeasureMemberDetails', 'MeasureMemberMetadata',
    'MeasureMemberUnitTranslations', 'MetadataCubeQuery',
    'MetadataDataCategory', 'MetadataDataSourceDefinitionValidation',
    'MetadataDataSourceDefinitionValidationExposeDataSource',
    'MetadataDefaultResultStructureResultAlignmentBottom',
    'MetadataDimensionCanBeAggregated', 'MetadataDimensionDefaultMember',
    'MetadataDimensionGroup', 'MetadataDimensionIsModeled',
    'MetadataDimensionVisibility', 'MetadataDynamicVariable',
    'MetadataExtendedDimensionVisibility', 'MetadataHasExternalHierarchies',
    'MetadataHierarchyLevels', 'MetadataHierarchyRestNode',
    'MetadataHierarchyStructure', 'MetadataHierarchyUniqueName',
    'MetadataIsDisplayAttribute', 'MetadataNonUniqueDisplayAttribute',
    'MetadataRepositorySuffix', 'MetadataResultFormatOptions',
    'MetadataSemanticType', 'MultipleExAggDimsInCalcPlan',
    'NamePath', 'NamedCustomDimensionMember',
    'NoDataActions', 'NullZeroSuppression',
    'NumericShiftPercent', 'Obtainability',
    'OthersDetailsFromConditions', 'OthersFromConditions',
    'PagingTupleCountBeforeSlicing', 'PagingTupleCountTotal',
    'PersistResultSet', 'PlanningOnCalculatedDimension',
    'ReadMode', 'ReadModeRelatedBooked',
    'RemoteBlending', 'RemoteBlendingBW',
    'RemoteBlendingMetadata', 'RemoteFilter',
    'RequestTimeZone', 'RestrictedMembersConvertToFlatSelection',
    'ResultSetAxisType', 'ResultSetCache',
    'ResultSetCellDataType', 'ResultSetCellExplain',
    'ResultSetCellFormatString', 'ResultSetCellFormatTypeSpecific',
    'ResultSetCellMeasure', 'ResultSetCellNumericShift',
    'ResultSetHierarchyLevel', 'ResultSetInterval',
    'ResultSetNumericTypesAsText', 'ResultSetNumericValueWithInternalPrecision',
    'ResultSetState', 'ResultSetUnitIndex',
    'ResultSetV2MetadataExtension1', 'ReturnErrorForInvalidQueryModel',
    'ReturnRestrictedAndCalculatedMembersInReadmodeBooked',
    'ReturnedDataSelection', 'RootOrphanNodesAfterVisibilityFilter',
    'SP9', 'SQLTypeBoolean',
    'SemanticalErrorType', 'SetNullCellsUnitType',
    'SetOperandCurrentMemberSingleNavigation', 'SimpleNumericVariableAsString',
    'Simulation', 'SortNewValues',
    'SortTupleMemberType', 'SortedIteratedFormula',
    'SpatialClustering', 'SpatialFilterSRID',
    'SpatialTransformDistanceFilter', 'StatisticalAggregations',
    'SupportsComplexFilters', 'SupportsCubeBlendingAggregation',
    'SupportsDataCellMixedValues', 'SupportsDisplayAttributes',
    'SupportsEncodedResultSet', 'SupportsEncodedResultSet2',
    'SupportsExtendedSort', 'SupportsHierarchySelectionAsFlatSelection',
    'SupportsIgnoreExternalDimensions', 'SupportsInAModelMetadata',
    'SupportsMemberVisibility', 'SupportsSetOperand',
    'SupportsSpatialFilter', 'SupportsSpatialTransformations',
    'TechnicalAxis', 'Totals',
    'TotalsAfterVisibilityFilter', 'TuplesOperandFromDataSource',
    'UndefinedTupleCountTotals', 'UnifiedDataCells',
    'UniqueAttributeNames', 'UniqueAxisProperties',
    'UnitTranslation', 'UnivModelInheritedPropsRaisedPriority',
    'UniversalModel', 'UseEPMVersion',
    'ValuesRounded', 'Variables',
    'VirtualDataSourceTypeColumns', 'VirtualDataSourceVariableValues',
    'VisibilityFilter', 'VisualAggregation',
] as const;

// ---------------------------------------------------------------------------
// Response Zod schemas — based on real Datasphere InAModel responses
// ---------------------------------------------------------------------------

export const InaMessageSchema = z.object({
    Number: z.number().optional(),
    Text: z.string().optional(),
    Type: z.number().optional(),
}).passthrough();

const EncodedArraySchema = z.object({
    Encoding: z.string().optional(),
    Values: z.array(z.unknown()),
}).passthrough();

export const InaAttributeSchema = z.object({
    Name: z.string(),
    Description: z.string().optional(),
    IsKey: z.boolean().optional(),
    DataType: z.number().optional(),
    ValueType: z.string().optional(),
    PresentationType: z.string().optional(),
    Obtainability: z.string().optional(),
    Values: z.array(z.unknown()).optional(),
}).passthrough();

export const InaDimensionSchema = z.object({
    Name: z.string(),
    Description: z.string().optional(),
    DimensionType: z.number().optional(),
    Attributes: z.array(InaAttributeSchema).optional(),
}).passthrough();

export const InaTupleSchema = z.object({
    TupleElementIds: EncodedArraySchema.optional(),
    MemberIndexes: EncodedArraySchema.optional(),
    ParentIndexes: EncodedArraySchema.optional(),
    DisplayLevel: EncodedArraySchema.optional(),
}).passthrough();

export const InaAxisSchema = z.object({
    Name: z.string().optional(),
    Type: z.string().optional(),
    Dimensions: z.array(InaDimensionSchema).optional(),
    TupleCountTotal: z.number().optional(),
    TupleCount: z.number().optional(),
    Tuples: z.array(InaTupleSchema).optional(),
}).passthrough();

export const InaCellsV2Schema = z.object({
    Values: EncodedArraySchema.optional(),
    ValuesRounded: EncodedArraySchema.optional(),
    ValuesFormatted: EncodedArraySchema.optional(),
    Units: EncodedArraySchema.optional(),
    UnitDescriptions: EncodedArraySchema.optional(),
    CellMeasure: EncodedArraySchema.optional(),
    CellDataType: EncodedArraySchema.optional(),
    CellFormat: EncodedArraySchema.optional(),
    UnitIndex: EncodedArraySchema.optional(),
}).passthrough();

export const InaGridSchema = z.object({
    HasErrors: z.boolean().optional(),
    ResultFormat: z.string().optional(),
    ResultEncoding: z.string().optional(),
    Axes: z.array(InaAxisSchema).optional(),
    Cells: z.union([InaCellsV2Schema, z.array(z.unknown())]).optional(),
    CellArraySizes: z.array(z.number()).optional(),
    Units: z.array(z.record(z.unknown())).optional(),
    Messages: z.array(InaMessageSchema).optional(),
    SubSetDescription: z.object({
        RowFrom: z.number(),
        RowTo: z.number(),
        ColumnFrom: z.number(),
        ColumnTo: z.number(),
    }).optional(),
}).passthrough();

export const InaServerInfoResponseSchema = z.object({
    ServerInfo: z.object({
        ServerType: z.string().optional(),
        Version: z.string().optional(),
        SystemId: z.string().optional(),
    }).passthrough().optional(),
    Services: z.array(z.record(z.unknown())).optional(),
}).passthrough();

// Variable definition returned in DataSource.Variables
export const InaVariableDefinitionSchema = z.object({
    Name: z.string(),
    Description: z.string().optional(),
    InputType: z.number().optional(),
    ValueType: z.string().optional(),
    DataType: z.number().optional(),
    DimensionName: z.string().optional(),
    HasDefaultValues: z.boolean().optional(),
    DefaultValues: z.array(z.unknown()).optional(),
    Values: z.unknown().optional(),
}).passthrough();

export const InaDataSourceResponseSchema = z.object({
    ObjectName: z.string().optional(),
    SchemaName: z.string().optional(),
    InstanceId: z.string().optional(),
    Variables: z.array(InaVariableDefinitionSchema).optional(),
}).passthrough();

export const InaResponseSchema = z.object({
    Grids: z.array(InaGridSchema).optional(),
    Messages: z.array(InaMessageSchema).optional(),
    DataSource: InaDataSourceResponseSchema.optional(),
}).passthrough();

// ---------------------------------------------------------------------------
// Inferred response types
// ---------------------------------------------------------------------------

export type InaGrid = z.infer<typeof InaGridSchema>;
export type InaAxis = z.infer<typeof InaAxisSchema>;
export type InaDimension = z.infer<typeof InaDimensionSchema>;
export type InaAttribute = z.infer<typeof InaAttributeSchema>;
export type InaCellsV2 = z.infer<typeof InaCellsV2Schema>;
export type InaMessage = z.infer<typeof InaMessageSchema>;

// ---------------------------------------------------------------------------
// Request payload types (outbound — no Zod needed)
// ---------------------------------------------------------------------------

export interface InaDataSource {
    ObjectName: string;
    SchemaName: string;
    Type?: string;
    InstanceId?: string;
}

export interface InaDimensionRequest {
    Name: string;
    Axis: 'Rows' | 'Columns';
    ReadMode?: string;
    ResultStructure?: Array<{ Result: string; Visibility: string }>;
    Attributes?: Array<{ Name: string; Obtainability?: string }>;
    Members?: Array<{ MemberName: string }>;
}

export interface InaVariable {
    Name: string;
    SimpleStringValues?: string[];
    SimpleNumericValues?: number[];
    Values?: {
        Selection: {
            SetOperand: {
                Elements: Array<{ Comparison: string; Low: string; High?: string }>;
                FieldName: string;
            };
        };
    };
}

export interface InaFilterSelection {
    FieldName: string;
    SetOperand: {
        Elements: Array<{
            Comparison: string;
            Low: string;
            High?: string;
        }>;
    };
}

export interface InaQueryOptions {
    dataSource: InaDataSource;
    dimensions?: InaDimensionRequest[];
    measures?: string[];
    variables?: InaVariable[];
    filter?: InaFilterSelection;
    rowLimit?: number;
    columnLimit?: number;
}

// ---------------------------------------------------------------------------
// Result types (all carry `raw` for debugging undocumented protocol)
// ---------------------------------------------------------------------------

export interface InaServerInfo {
    serverType: string;
    version: string;
    capabilities: string[];
    raw: unknown;
}

export interface InaDimensionInfo {
    name: string;
    description?: string;
    dimensionType?: number;
    attributes: InaAttributeInfo[];
}

export interface InaAttributeInfo {
    name: string;
    description?: string;
    isKey: boolean;
    dataType?: string;
}

export interface InaVariableInfo {
    name: string;
    description?: string;
    mandatory: boolean;
    valueType: 'string' | 'numeric' | 'date' | 'unknown';
    dimensionName?: string;
    defaultValues: unknown[];
}

export interface InaMetadataResult {
    dimensions: InaDimensionInfo[];
    measures: string[];
    variables: InaVariableInfo[];
    raw: unknown;
}

export interface InaCellRow {
    [dimensionOrMeasure: string]: unknown;
}

export interface InaQueryResult {
    rows: InaCellRow[];
    totalRows: number;
    totalColumns: number;
    units: Record<string, string>;
    raw: unknown;
}

// ---------------------------------------------------------------------------
// High-level discovery & simplified query types
// ---------------------------------------------------------------------------

export interface InaModelEntry {
    name: string;
    businessName: string | null;
    description: string | null;
    instanceId: string;
}

export interface InaModelDetails {
    name: string;
    instanceId: string;
    dimensions: InaDimensionInfo[];
    measures: string[];
    variables: InaVariableInfo[];
    raw: unknown;
}

export interface InaSimpleQueryOptions {
    model: string;
    columns?: string[];
    measures?: string[];
    variables?: Record<string, string | number>;
    filter?: InaFilterSelection;
    limit?: number;
}

