let verbose = false;

export function activateLogging(): void {
    verbose = true;
}

export function debug(...args: unknown[]): void {
    if (verbose) console.log('[bdc]', ...args);
}
