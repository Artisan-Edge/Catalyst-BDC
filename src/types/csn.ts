/**
 * CSN (Core Schema Notation) file structure types
 *
 * Typed from actual Datasphere CSN exports — see __tests__/assets/I_BusinessArea.json
 */

export interface CsnElement {
    key?: boolean;
    notNull?: boolean;
    type?: string;
    length?: number;
    '@EndUserText.label'?: string;
    [key: string]: unknown;
}

export interface CsnEntity {
    kind: string;
    elements?: Record<string, CsnElement>;
    '@EndUserText.label'?: string;
    '@ObjectModel.modelingPattern'?: { '#': string };
    '@ObjectModel.supportedCapabilities'?: Array<{ '#': string }>;
    _meta?: {
        dependencies?: Record<string, string>;
    };
    [key: string]: unknown;
}

export interface CsnReplicationFlow {
    kind: 'sap.dis.replicationflow';
    '@EndUserText.label'?: string;
    contents?: Record<string, unknown>;
    sources?: Record<string, unknown>;
    targets?: Record<string, { elements?: Record<string, unknown> }>;
    connections?: Record<string, unknown>;
    [key: string]: unknown;
}

export interface CsnVersion {
    csn: string;
}

export interface CsnMeta {
    creator: string;
}

export interface CsnFile {
    definitions?: Record<string, CsnEntity>;
    replicationflows?: Record<string, CsnReplicationFlow>;
    version?: CsnVersion;
    meta?: CsnMeta;
    $version?: string;
    [key: string]: unknown;
}
