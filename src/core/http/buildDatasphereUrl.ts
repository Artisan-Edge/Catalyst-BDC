export function buildDatasphereUrl(
    host: string,
    path: string,
    params?: Record<string, string>,
): string {
    const base = host.replace(/\/+$/, '');
    const url = new URL(path, base);
    if (params) {
        for (const [key, value] of Object.entries(params)) {
            url.searchParams.set(key, value);
        }
    }
    return url.toString();
}
