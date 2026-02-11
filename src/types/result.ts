export type Result<T, E extends Error = Error> = [T, null] | [null, E];

export type AsyncResult<T, E extends Error = Error> = Promise<Result<T, E>>;

export function ok<T>(value: T): Result<T, never> {
    return [value, null];
}

export function err<E extends Error = Error>(error: E): Result<never, E> {
    return [null, error];
}
