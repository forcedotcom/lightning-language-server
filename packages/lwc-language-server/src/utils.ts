import { extname, join, resolve } from 'path';
import * as fs from 'fs';
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

export function appendLineIfMissing(file: string, line: string) {
    if (!fs.existsSync(file)) {
        fs.writeFileSync(file, line + '\n');
    } else if (!fileContainsLine(file, line)) {
        fs.appendFileSync(file, '\n' + line + '\n');
    }
}

function fileContainsLine(file: string, expectLine: string) {
    const trimmed = expectLine.trim();
    for (const line of fs.readFileSync(file).toString().split('\n')) {
        if (line.trim() === trimmed) {
            return true;
        }
    }
    return false;
}

/**
 * @return string showing elapsed milliseconds from start mark
 */
export function elapsedMillis(start: [number, number]): string {
    const elapsed = process.hrtime(start);
    return (elapsed[0] * 1000 + elapsed[1] / 1e6).toFixed(2) + ' ms';
}
