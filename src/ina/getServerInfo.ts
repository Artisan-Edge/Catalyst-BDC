import type { DatasphereRequestor } from '../types/requestor';
import type { AsyncResult } from '../types/result';
import { ok, err } from '../types/result';
import { safeJsonParse } from '../core/utils/json';
import { debug } from '../core/utils/logging';
import { INA_GET_SERVER_INFO_PATH, InaServerInfoResponseSchema } from './types';
import type { InaServerInfo } from './types';

export async function getServerInfo(
    requestor: DatasphereRequestor,
): AsyncResult<InaServerInfo> {
    debug(`INA getServerInfo: GET ${INA_GET_SERVER_INFO_PATH}`);

    const [response, reqErr] = await requestor.request({
        method: 'GET',
        path: INA_GET_SERVER_INFO_PATH,
        headers: {
            'Accept': 'application/json',
        },
    });

    if (reqErr) return err(reqErr);

    const body = await response.text();
    if (!response.ok) {
        return err(new Error(`INA getServerInfo: HTTP ${response.status} — ${body.substring(0, 500)}`));
    }

    const [parsed, parseErr] = safeJsonParse(body, InaServerInfoResponseSchema);
    if (parseErr) return err(new Error(`INA getServerInfo: ${parseErr.message}`));

    // Extract capability names from the Services array
    const capabilities: string[] = [];
    const services = parsed.Services ?? [];
    for (const service of services) {
        const caps = service['Capabilities'] as Array<{ Capability?: string }> | undefined;
        if (caps) {
            for (const cap of caps) {
                if (cap.Capability) capabilities.push(cap.Capability);
            }
        }
    }

    const serverInfo = parsed.ServerInfo ?? {};

    debug(`INA getServerInfo: ${serverInfo.ServerType ?? 'unknown'} v${serverInfo.Version ?? '?'}, ${capabilities.length} capabilities`);

    return ok({
        serverType: (serverInfo.ServerType as string) ?? 'unknown',
        version: (serverInfo.Version as string) ?? 'unknown',
        capabilities,
        raw: parsed,
    });
}
