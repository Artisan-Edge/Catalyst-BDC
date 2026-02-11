import type { CsnFile } from '../../types/csn';
import type { AsyncResult } from '../../types/result';
import { ok, err } from '../../types/result';
import type { CliExecutor } from '../cli/executor';
import { withTempCsn } from '../cli/tempFile';
import { extractObject } from '../csn/extract';
import { resolveDependencies } from '../csn/resolveDeps';
import { DSP_OBJECT_TYPES } from '../../types/objectTypes';
import { objectExists } from './objectExists';
import type { RunReplicationFlowResult } from './runReplicationFlow';
import { debug } from '../utils/logging';

export interface ReplicationFlowResult {
    flowOutput: string;
    flowAction: 'created' | 'updated';
    depOutputs: Array<{ name: string; output: string; action: 'created' | 'updated' }>;
    runResult?: RunReplicationFlowResult;
}

export async function upsertReplicationFlow(
    csn: CsnFile,
    objectName: string,
    executor: CliExecutor,
): AsyncResult<ReplicationFlowResult> {
    const objectType = DSP_OBJECT_TYPES['replication-flow'];

    // 1. Resolve and upsert dependency local tables
    const depNames = resolveDependencies(csn, objectName, objectType);
    const depOutputs: ReplicationFlowResult['depOutputs'] = [];

    if (depNames.length > 0) {
        if (!objectType.preDeps) return err(new Error('Dependencies found but no preDeps configuration'));
        const { preDeps } = objectType;

        for (const depName of depNames) {
            const [depPayload, depExtractErr] = extractObject(csn, preDeps.csnKey, depName);
            if (depExtractErr) return err(depExtractErr);

            const [exists, existsErr] = await objectExists(preDeps.readCommand, depName, executor);
            if (existsErr) return err(existsErr);

            const action = exists ? 'updated' : 'created';
            const command = exists ? preDeps.updateCommand : preDeps.command;
            debug(`${exists ? 'Updating' : 'Creating'} dependency: local table "${depName}"...`);

            const [depOutput, depExecErr] = await withTempCsn(depPayload, async (tmpFile) => {
                const [depResult, execErr] = await executor.exec({
                    command,
                    flags: ['--file-path', tmpFile, '--allow-missing-dependencies'],
                });
                if (execErr) return err(execErr);
                return ok(depResult.stdout);
            });
            if (depExecErr) return err(depExecErr);
            depOutputs.push({ name: depName, output: depOutput, action });
        }
    }

    // 2. Upsert the replication flow itself
    const [flowPayload, flowExtractErr] = extractObject(csn, objectType.csnKey, objectName);
    if (flowExtractErr) return err(flowExtractErr);

    const [flowExists, flowExistsErr] = await objectExists(objectType.readCommand, objectName, executor);
    if (flowExistsErr) return err(flowExistsErr);

    const flowAction = flowExists ? 'updated' : 'created';
    const flowCommand = flowExists ? objectType.updateCommand : objectType.command;
    debug(`${flowExists ? 'Updating' : 'Creating'} replication flow "${objectName}"...`);

    const [flowOutput, flowExecErr] = await withTempCsn(flowPayload, async (tmpFile) => {
        const [flowResult, execErr] = await executor.exec({
            command: flowCommand,
            flags: ['--file-path', tmpFile, '--allow-missing-dependencies'],
        });
        if (execErr) return err(execErr);
        return ok(flowResult.stdout);
    });
    if (flowExecErr) return err(flowExecErr);

    return ok({
        flowOutput,
        flowAction,
        depOutputs,
    });
}
