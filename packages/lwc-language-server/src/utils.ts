import { extname, join, resolve } from 'path';
import * as fs from 'fs';
import equal = require('deep-equal');
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

export function getCoreResource(resourceName: string) {
    return join(__dirname, RESOURCES_DIR, 'core', resourceName);
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
    for (const line of fs
        .readFileSync(file)
        .toString()
        .split('\n')) {
        if (line.trim() === trimmed) {
            return true;
        }
    }
    return false;
}

/**
 * Deep merges the 'from' object into the 'to' object
 * (assumes simple JSON config objects)
 * @return true if the 'to' object was modified, false otherwise
 */
export function deepMerge(to: object, from: object): boolean {
    let modified = false;
    for (const key of Object.keys(from)) {
        const fromVal = (from as any)[key];
        const toVal = to.hasOwnProperty(key) ? (to as any)[key] : undefined;
        if (!to.hasOwnProperty(key)) {
            // if 'to' doesn't have the property just assign the 'from' one
            (to as any)[key] = fromVal;
            modified = true;
        } else if (Array.isArray(fromVal)) {
            // assign 'from' array values to the 'to' array (create array if 'to' is a scalar)
            const toArray = Array.isArray(toVal) ? (toVal as any[]) : ((to as any)[key] = [toVal]);
            for (const e of fromVal as any[]) {
                if (!toArray.some(value => equal(value, e))) {
                    toArray.push(e);
                    modified = true;
                }
            }
        } else if (Array.isArray(toVal)) {
            // if 'to' is array and 'from' scalar, push 'from' to the array
            (toVal as any[]).push(fromVal);
            modified = true;
        } else if (fromVal != null && typeof fromVal === 'object') {
            // merge object values
            if (deepMerge(toVal, fromVal)) {
                modified = true;
            }
        } else if (fromVal !== toVal) {
            // 'from' overwrites 'to' if 'to' and 'from' have different scalar values
            (to as any)[key] = fromVal;
            modified = true;
        }
    }
    return modified;
}

/**
 * @return string showing elapsed milliseconds from start mark
 */
export function elapsedMillis(start: [number, number]): string {
    const elapsed = process.hrtime(start);
    return (elapsed[0] * 1000 + elapsed[1] / 1e6).toFixed(2) + ' ms';
}
