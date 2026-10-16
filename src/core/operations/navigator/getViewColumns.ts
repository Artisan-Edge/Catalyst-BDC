import type { DatasphereRequestor } from '../../../types/requestor';
import type { AsyncResult } from '../../../types/result';
import { ok, err } from '../../../types/result';
import { debug } from '../../utils/logging';

export interface ViewColumn {
    name: string;
    type: string;
    maxLength: number | null;
    precision: number | null;
    scale: number | null;
    isKey: boolean;
}

// Match <Property Name="..." Type="..." .../> from EDMX XML
const PROPERTY_REGEX = /<Property\s+([^>]+)\/?\s*>/g;
const KEY_PROPERTY_REF_REGEX = /<PropertyRef\s+Name="([^"]+)"/g;

function parseAttribute(element: string, attr: string): string | null {
    const regex = new RegExp(`${attr}="([^"]*)"`, 'i');
    const match = element.match(regex);
    return match ? match[1]! : null;
}

function parseEdmx(xml: string): ViewColumn[] {
    // Extract key property names
    const keyNames = new Set<string>();
    let keyMatch: RegExpExecArray | null;
    while ((keyMatch = KEY_PROPERTY_REF_REGEX.exec(xml)) !== null) {
        keyNames.add(keyMatch[1]!);
    }

    // Extract properties
    const columns: ViewColumn[] = [];
    let propMatch: RegExpExecArray | null;
    while ((propMatch = PROPERTY_REGEX.exec(xml)) !== null) {
        const attrs = propMatch[1]!;
        const name = parseAttribute(attrs, 'Name');
        const type = parseAttribute(attrs, 'Type');
        if (!name || !type) continue;

        const maxLengthStr = parseAttribute(attrs, 'MaxLength');
        const precisionStr = parseAttribute(attrs, 'Precision');
        const scaleStr = parseAttribute(attrs, 'Scale');

        columns.push({
            name,
            type,
            maxLength: maxLengthStr ? parseInt(maxLengthStr, 10) : null,
            precision: precisionStr ? parseInt(precisionStr, 10) : null,
            scale: scaleStr ? parseInt(scaleStr, 10) : null,
            isKey: keyNames.has(name),
        });
    }

    return columns;
}

export async function getViewColumns(
    requestor: DatasphereRequestor,
    spaceName: string,
    viewName: string,
): AsyncResult<ViewColumn[]> {
    const path = `/dwaas-core/data-access/instant/${spaceName}/${viewName}/$metadata`;
    debug(`Fetching metadata for: ${viewName}`);

    const [response, reqErr] = await requestor.request({
        method: 'GET',
        path,
        headers: { 'Accept': 'application/xml' },
    });

    if (reqErr) return err(reqErr);
    if (!response) return err(new Error('getViewColumns: No response'));

    const body = await response.text();
    if (!response.ok) return err(new Error(`getViewColumns: HTTP ${response.status} — ${body.substring(0, 500)}`));

    const columns = parseEdmx(body);
    if (columns.length === 0) {
        return err(new Error(`getViewColumns: No properties found in $metadata for ${viewName}`));
    }

    debug(`Found ${columns.length} columns for ${viewName}`);
    return ok(columns);
}
