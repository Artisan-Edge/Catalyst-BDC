import type { CsnFile } from '../../types/csn';
import type { AsyncResult } from '../../types/result';
import type { CliExecutor } from '../cli/executor';
import { createObject } from './createObject';

export async function createLocalTable(
    csn: CsnFile,
    objectName: string,
    executor: CliExecutor,
): AsyncResult<string> {
    return createObject(csn, objectName, 'local-table', executor);
}
