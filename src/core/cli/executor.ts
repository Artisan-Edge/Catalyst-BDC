import { spawn } from 'child_process';
import type { BdcConfig } from '../../types/config';
import type { AsyncResult } from '../../types/result';
import { ok, err } from '../../types/result';
import { debug } from '../utils/logging';

export interface CliExecOptions {
    command: string;
    flags?: string[];
    quiet?: boolean;
}

export interface CliExecResult {
    stdout: string;
}

export interface CliExecutor {
    exec(options: CliExecOptions): AsyncResult<CliExecResult, Error>;
}

export function spawnAsync(cmd: string, args: string[]): Promise<{ code: number; stdout: string; stderr: string }> {
    return new Promise((resolve) => {
        try {
            const child = spawn(cmd, args, {
                stdio: ['pipe', 'pipe', 'pipe'],
                shell: process.platform === 'win32',
            });

            // Close stdin immediately so interactive prompts receive EOF
            // and fall through instead of hanging the process.
            child.stdin.end();

            let stdout = '';
            let stderr = '';
            child.stdout.on('data', (data: Buffer) => { stdout += data.toString(); });
            child.stderr.on('data', (data: Buffer) => { stderr += data.toString(); });

            child.on('error', (e) => resolve({ code: 1, stdout: '', stderr: e.message }));
            child.on('close', (code) => resolve({ code: code ?? 1, stdout, stderr }));
        } catch (e: unknown) {
            const message = e instanceof Error ? e.message : 'Failed to spawn process';
            resolve({ code: 1, stdout: '', stderr: message });
        }
    });
}

export function createCliExecutor(config: BdcConfig): CliExecutor {
    return {
        async exec(options: CliExecOptions): AsyncResult<CliExecResult, Error> {
            const args = [
                'datasphere', ...options.command.split(' '),
                '--space', config.space,
                '--host', config.host,
                ...(config.verbose ? ['--verbose'] : []),
                ...(options.flags ?? []),
            ];

            debug('>', 'npx', ...args);

            const result = await spawnAsync('npx', args);

            if (result.code !== 0) {
                if (!options.quiet) {
                    if (result.stdout) debug('CLI stdout:', result.stdout);
                    if (result.stderr) debug('CLI stderr:', result.stderr);
                }
                return err(new Error(result.stdout?.trim() || result.stderr?.trim() || 'CLI execution failed'));
            }

            return ok({ stdout: result.stdout.trim() });
        },
    };
}
