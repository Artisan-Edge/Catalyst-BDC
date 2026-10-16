import { z } from 'zod';

// Folder hierarchy entry from search API
export const FolderHierarchyEntrySchema = z.object({
    folder_id: z.string(),
    folder_name: z.string(),
    folder_icon: z.string().nullable(),
});

export type FolderHierarchyEntry = z.infer<typeof FolderHierarchyEntrySchema>;

const ParentHierarchySchema = z.object({
    scope: z.string(),
    hierarchy: z.array(FolderHierarchyEntrySchema),
});

// Zod schema for a search result from /deepsea/repository/{space}/search/$all
export const SearchObjectSchema = z.object({
    id: z.string(),
    name: z.string(),
    kind: z.string(),
    space_id: z.string(),
    space_name: z.string().nullable(),
    business_name: z.string().nullable(),
    description: z.string().nullable(),
    folder_id: z.string().nullable(),
    folder_name: z.string().nullable(),
    technical_type: z.string().nullable(),
    technical_type_description: z.string().nullable(),
    business_type: z.string().nullable(),
    business_type_description: z.string().nullable(),
    deployment_status: z.string().nullable(),
    deployment_status_description: z.string().nullable(),
    object_status: z.string().nullable(),
    object_status_description: z.string().nullable(),
    creation_date: z.string().nullable(),
    modification_date: z.string().nullable(),
    creator_user_name: z.string().nullable(),
    changed_by_user_name: z.string().nullable(),
    exposed_for_consumption: z.string().nullable(),
    '@com.sap.vocabularies.Search.v1.ParentHierarchies': z.array(ParentHierarchySchema).optional(),
}).passthrough();

export type SearchObject = z.infer<typeof SearchObjectSchema>;

export const SearchResponseSchema = z.object({
    '@odata.count': z.number().optional(),
    'value': z.array(SearchObjectSchema),
}).passthrough();

export type SearchResponse = z.infer<typeof SearchResponseSchema>;

// Simplified design object from /deepsea/repository/{space}/designObjects (kept for compatibility)
export const DesignObjectSchema = z.object({
    space_id: z.string(),
    qualified_name: z.string(),
    name: z.string(),
    hash: z.string(),
    kind: z.string(),
    id: z.string(),
}).passthrough();

export type DesignObject = z.infer<typeof DesignObjectSchema>;

export const DesignObjectsResponseSchema = z.object({
    results: z.array(DesignObjectSchema),
});

// Known object kinds
export const DESIGN_OBJECT_KINDS = {
    space: 'sap.dwc.space',
    folder: 'sap.repo.folder',
    entity: 'entity',
    replicationFlow: 'sap.dis.replicationflow',
    dataflow: 'sap.dis.dataflow',
    transformationFlow: 'sap.dis.transformationflow',
    taskChain: 'sap.dwc.taskChain',
    analyticModel: 'sap.dwc.analyticModel',
    dac: 'sap.dwc.dac',
} as const;

export type DesignObjectKind = (typeof DESIGN_OBJECT_KINDS)[keyof typeof DESIGN_OBJECT_KINDS];

// Filter options for listing objects
export interface ListObjectsOptions {
    kind?: string | string[];
    pattern?: string;
    excludeFolders?: boolean;
}

// Search options for the search API
export interface SearchOptions {
    query?: string;
    folderId?: string;
    kinds?: string[];
    top?: number;
    skip?: number;
}

// Folder info
export interface SpaceFolder {
    name: string;
    id: string;
    displayName: string | null;
    parentId: string | null;
}
