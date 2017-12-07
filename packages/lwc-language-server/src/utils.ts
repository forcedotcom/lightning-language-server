import { extname, join, resolve } from 'path';
import { TextDocument } from 'vscode-languageserver';
import URI from 'vscode-uri';

const RESOURCES_DIR = 'resources';
const LWC_STANDARD: string = 'lwc-standard.json';

export function toResolvedPath(uri: string): string {
    return resolve(URI.parse(uri).path);
}

export function getExtension(textDocument: TextDocument): string {
    const filePath = URI.parse(textDocument.uri).path;
    return filePath ? extname(filePath) : '';
}

export function getResourcePath(resourceName: string) {
    return join(__dirname, RESOURCES_DIR, resourceName);
}

export function getlwcStandardResourcePath() {
    return join(__dirname, RESOURCES_DIR, LWC_STANDARD);
}

export function getSfdxResource(resourceName: string) {
    return join(__dirname, RESOURCES_DIR, 'sfdx', resourceName);
}

/**
 * @return string showing elapsed milliseconds from start mark
 */
export function elapsedMillis(start: [number, number]): string {
    const elapsed = process.hrtime(start);
    return (elapsed[0] * 1000 + elapsed[1] / 1e6).toFixed(2) + ' ms';
}
