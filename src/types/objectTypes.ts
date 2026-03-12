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
    'analytic-model': {
        endpoint: 'analyticmodels',
        csnKey: 'definitions',
    },
} as const satisfies Record<string, DatasphereObjectType>;

export type DatasphereObjectTypeName = keyof typeof DATASPHERE_OBJECT_TYPES;
