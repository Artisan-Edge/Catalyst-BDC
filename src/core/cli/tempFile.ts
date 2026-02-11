import { randomUUID } from 'crypto';
import fs from 'fs';
import os from 'os';
import path from 'path';

export function writeTempCsn(payload: object): string {
    const tmpFile = path.join(os.tmpdir(), `datasphere-csn-${randomUUID()}.json`);
    fs.writeFileSync(tmpFile, JSON.stringify(payload, null, 2));
    return tmpFile;
}

export function cleanupTempFile(filePath: string): void {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
}

// Writes a temp CSN file, runs the callback, then cleans up
export async function withTempCsn<T>(payload: object, fn: (tmpFile: string) => Promise<T>): Promise<T> {
    const tmpFile = writeTempCsn(payload);
    try {
        return await fn(tmpFile);
    } finally {
        cleanupTempFile(tmpFile);
    }
}
