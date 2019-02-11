import * as fs from 'fs-extra';
import { dirname, extname, join, relative, resolve } from 'path';
import { TextDocument, FileEvent, FileChangeType } from 'vscode-languageserver';
import URI from 'vscode-uri';
import equal from 'deep-equal';
import { WorkspaceContext } from './context';
import { WorkspaceType } from './shared';
import { promisify } from 'util';
import { Glob } from 'glob';

export const readdir: (arg1: string | Buffer) => Promise<string[]> = promisify(fs.readdir);
export const writeFile: (arg1: string | number | Buffer, data: any) => Promise<void> = promisify(fs.writeFile);
export const readFile: (arg1: string | number | Buffer) => Promise<string> = promisify(fs.readFile);
export const pathExists: (path: string) => Promise<boolean> = promisify(fs.pathExists);
export const stat: (arg1: string | Buffer) => Promise<fs.Stats> = promisify(fs.stat);

export const glob = promisify(Glob);

const RESOURCES_DIR = 'resources';

/**
 * @return true if changes include a directory delete
 */
export function includesDeletedLwcWatchedDirectory(context: WorkspaceContext, changes: FileEvent[]): boolean {
    for (const event of changes) {
        if (event.type === FileChangeType.Deleted && isLWCWatchedDirectory(context, event.uri)) {
            return true;
        }
    }
    return false;
}
export function includesDeletedAuraWatchedDirectory(context: WorkspaceContext, changes: FileEvent[]): boolean {
    for (const event of changes) {
        if (event.type === FileChangeType.Deleted && isAuraWatchedDirectory(context, event.uri)) {
            return true;
        }
    }
    return false;
}

export function isLWCRootDirectoryCreated(context: WorkspaceContext, changes: FileEvent[]) {
    for (const event of changes) {
        if (event.type === FileChangeType.Created && isLWCRootDirectory(context, event.uri)) {
            return true;
        }
    }
    return false;
}

export function isAuraRootDirectoryCreated(context: WorkspaceContext, changes: FileEvent[]) {
    for (const event of changes) {
        if (event.type === FileChangeType.Created && isAuraDirectory(context, event.uri)) {
            return true;
        }
    }
    return false;
}

function isLWCRootDirectory(context: WorkspaceContext, uri: string) {
    if (context.type === WorkspaceType.SFDX) {
        const file = toResolvedPath(uri);
        return file.endsWith('lwc');
    }
    return false;
}

function isAuraDirectory(context: WorkspaceContext, uri: string) {
    if (context.type === WorkspaceType.SFDX) {
        const file = toResolvedPath(uri);
        return file.endsWith('aura');
    }
    return false;
}

export function isLWCWatchedDirectory(context: WorkspaceContext, uri: string) {
    const file = toResolvedPath(uri);
    return file.indexOf('.') === -1 && context.isFileInsideModulesRoots(file);
}

export function isAuraWatchedDirectory(context: WorkspaceContext, uri: string) {
    const file = toResolvedPath(uri);
    return file.indexOf('.') === -1 && context.isFileInsideAuraRoots(file);
}

export function relativePath(from: string, to: string): string {
    return unixify(relative(from, to));
}

export function unixify(filePath: string): string {
    return filePath.replace(/\\/g, '/');
}

export function readFileSync(file: string): string {
    return fs.readFileSync(file, { encoding: 'utf8' });
}

export function writeFileSync(file: string, contents: string) {
    fs.ensureDirSync(dirname(file));
    fs.writeFileSync(file, contents);
}

export function pathStartsWith(path: string, root: string) {
    if (process.platform === 'win32') {
        return path.toLowerCase().startsWith(root.toLowerCase());
    }
    return path.startsWith(root);
}

export function toResolvedPath(uri: string): string {
    return resolve(URI.parse(uri).fsPath);
}

export function getExtension(textDocument: TextDocument): string {
    const filePath = URI.parse(textDocument.uri).fsPath;
    return filePath ? extname(filePath) : '';
}

export function getResourcePath(resourceName: string) {
    return join(__dirname, RESOURCES_DIR, resourceName);
}

export function getSfdxResource(resourceName: string) {
    return join(__dirname, RESOURCES_DIR, 'sfdx', resourceName);
}

export function getCoreResource(resourceName: string) {
    return join(__dirname, RESOURCES_DIR, 'core', resourceName);
}

export function appendLineIfMissing(file: string, line: string) {
    if (!fs.existsSync(file)) {
        writeFileSync(file, line + '\n');
    } else if (!fileContainsLine(file, line)) {
        fs.appendFileSync(file, '\n' + line + '\n');
    }
}

function fileContainsLine(file: string, expectLine: string) {
    const trimmed = expectLine.trim();
    for (const line of readFileSync(file).split('\n')) {
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
            if (!toVal.includes(fromVal)) {
                toVal.push(fromVal);
                modified = true;
            }
        } else if (fromVal != null && typeof fromVal === 'object') {
            // merge object values
            if (deepMerge(toVal, fromVal)) {
                modified = true;
            }
        }
        // do not overwrite existing values
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

export const memoize = (fn: any) => {
    let cache: any;
    return () => {
        if (cache) {
            return cache;
        }
        cache = fn.apply(this);
        return cache;
    };
};