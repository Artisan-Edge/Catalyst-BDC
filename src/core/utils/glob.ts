// Convert a glob pattern (with * and ?) to a case-insensitive RegExp
export function globToRegex(pattern: string): RegExp {
    const escaped = pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&');
    const withWildcards = escaped.replace(/\*/g, '.*').replace(/\?/g, '.');
    return new RegExp(`^${withWildcards}$`, 'i');
}
