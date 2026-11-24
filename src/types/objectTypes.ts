import type { CsnFile } from './csn';

export interface DatasphereObjectType {
    endpoint: string;
    csnKey: keyof CsnFile & string;
}

export const DATASPHERE_OBJECT_TYPES = {
    view: {
        endpoint: 'views',
        csnKey: 'definitions',
    },
    'local-table': {
        endpoint: 'localtables',
        csnKey: 'definitions',
    },
    'replication-flow': {
        endpoint: 'replicationflows',
        csnKey: 'replicationflows',
    },
    'transformation-flow': {
        endpoint: 'transformationflows',
        csnKey: 'transformationflows',
    },
    'analytic-model': {
        endpoint: 'analyticmodels',
        csnKey: 'definitions',
    },
    // Path by analogy with the other types (SAP CLI type name without the hyphen); the tenant's discovery
    // document lists it, but no chain has been read through it yet
    'task-chain': {
        endpoint: 'taskchains',
        csnKey: 'taskchains',
    },
    // Path from the tenant's discovery document; a control is a CSN definition of kind entity
    'data-access-control': {
        endpoint: 'dataaccesscontrols',
        csnKey: 'definitions',
    },
} as const satisfies Record<string, DatasphereObjectType>;

export type DatasphereObjectTypeName = keyof typeof DATASPHERE_OBJECT_TYPES;
