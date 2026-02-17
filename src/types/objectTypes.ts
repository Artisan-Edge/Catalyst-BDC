import type { CsnFile } from './csn';

export interface DatasphereObjectType {
    endpoint: string;
    csnKey: keyof CsnFile & string;
    preDeps?: {
        csnKey: keyof CsnFile & string;
        endpoint: string;
        resolve: (csn: CsnFile, objectName: string) => string[];
    };
}

export const DATASPHERE_OBJECT_TYPES = {
    view: {
        endpoint: 'views',
        csnKey: 'definitions',
    },
    'local-table': {
        endpoint: 'localTable',
        csnKey: 'definitions',
    },
    'replication-flow': {
        endpoint: 'replicationflows',
        csnKey: 'replicationflows',
        preDeps: {
            csnKey: 'definitions',
            endpoint: 'localTable',
            resolve: (csn: CsnFile, objectName: string): string[] => {
                const flow = csn.replicationflows?.[objectName];
                if (!flow?.targets) return [];
                return Object.keys(flow.targets);
            },
        },
    },
} as const satisfies Record<string, DatasphereObjectType>;

export type DatasphereObjectTypeName = keyof typeof DATASPHERE_OBJECT_TYPES;
