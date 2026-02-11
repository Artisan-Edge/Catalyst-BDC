import type { CsnFile } from './csn';

export interface DspObjectType {
    command: string;
    readCommand: string;
    updateCommand: string;
    csnKey: keyof CsnFile & string;
    preDeps?: {
        csnKey: keyof CsnFile & string;
        command: string;
        readCommand: string;
        updateCommand: string;
        resolve: (csn: CsnFile, objectName: string) => string[];
    };
}

export const DSP_OBJECT_TYPES = {
    view: {
        command: 'objects views create',
        readCommand: 'objects views read',
        updateCommand: 'objects views update',
        csnKey: 'definitions',
    },
    'local-table': {
        command: 'objects local-tables create',
        readCommand: 'objects local-tables read',
        updateCommand: 'objects local-tables update',
        csnKey: 'definitions',
    },
    'replication-flow': {
        command: 'objects replication-flows create',
        readCommand: 'objects replication-flows read',
        updateCommand: 'objects replication-flows update',
        csnKey: 'replicationflows',
        preDeps: {
            csnKey: 'definitions',
            command: 'objects local-tables create',
            readCommand: 'objects local-tables read',
            updateCommand: 'objects local-tables update',
            resolve: (csn: CsnFile, objectName: string): string[] => {
                const flow = csn.replicationflows?.[objectName];
                if (!flow?.targets) return [];
                return Object.keys(flow.targets);
            },
        },
    },
} as const satisfies Record<string, DspObjectType>;

export type DspObjectTypeName = keyof typeof DSP_OBJECT_TYPES;
