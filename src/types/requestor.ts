import type { AsyncResult } from './result';

export interface DatasphereRequestOptions {
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'HEAD';
    path: string;
    params?: Record<string, string>;
    headers?: Record<string, string>;
    body?: string;
}

export interface DatasphereRequestor {
    request(options: DatasphereRequestOptions): AsyncResult<Response, Error>;
}
