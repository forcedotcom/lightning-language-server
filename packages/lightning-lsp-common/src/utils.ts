import * as fs from 'fs-extra';
import { basename, extname, join, parse, relative, resolve, dirname } from 'path';
import { TextDocument, FileEvent, FileChangeType } from 'vscode-languageserver';
import { URI } from 'vscode-uri';
import equal from 'deep-equal';
import { BaseWorkspaceContext } from './base-context';
import { WorkspaceType } from './shared';
import { promisify } from 'util';
import { Glob } from 'glob';
import * as jsonc from 'jsonc-parser';

export const glob = promisify(Glob);

const RESOURCES_DIR = 'resources';

async function fileContainsLine(file: string, expectLine: string): Promise<boolean> {
    const trimmed = expectLine.trim();
    for (const line of (await fs.readFile(file, 'utf8')).split('\n')) {
        if (line.trim() === trimmed) {
            return true;
        }
    }
    return false;
}

export function toResolvedPath(uri: string): string {
    return resolve(URI.parse(uri).fsPath);
}

function isLWCRootDirectory(context: BaseWorkspaceContext, uri: string): boolean {
    if (context.type === WorkspaceType.SFDX) {
        const file = toResolvedPath(uri);
        return file.endsWith('lwc');
    }
    return false;
}

function isAuraDirectory(context: BaseWorkspaceContext, uri: string): boolean {
    if (context.type === WorkspaceType.SFDX) {
        const file = toResolvedPath(uri);
        return file.endsWith('aura');
    }
    return false;
}

export async function isLWCWatchedDirectory(context: BaseWorkspaceContext, uri: string): Promise<boolean> {
    const file = toResolvedPath(uri);
    return await context.isFileInsideModulesRoots(file);
}

export async function isAuraWatchedDirectory(context: BaseWorkspaceContext, uri: string): Promise<boolean> {
    const file = toResolvedPath(uri);
    return await context.isFileInsideAuraRoots(file);
}

/**
 * @return true if changes include a directory delete
 */
// TODO This is not waiting for the response of the promise isLWCWatchedDirectory, maybe we have the same problem on includesDeletedAuraWatchedDirectory
export async function includesDeletedLwcWatchedDirectory(context: BaseWorkspaceContext, changes: FileEvent[]): Promise<boolean> {
    for (const event of changes) {
        if (event.type === FileChangeType.Deleted && event.uri.indexOf('.') === -1 && (await isLWCWatchedDirectory(context, event.uri))) {
            return true;
        }
    }
    return false;
}
export async function includesDeletedAuraWatchedDirectory(context: BaseWorkspaceContext, changes: FileEvent[]): Promise<boolean> {
    for (const event of changes) {
        if (event.type === FileChangeType.Deleted && event.uri.indexOf('.') === -1 && (await isAuraWatchedDirectory(context, event.uri))) {
            return true;
        }
    }
    return false;
}

export async function containsDeletedLwcWatchedDirectory(context: BaseWorkspaceContext, changes: FileEvent[]): Promise<boolean> {
    for (const event of changes) {
        const insideLwcWatchedDirectory = await isLWCWatchedDirectory(context, event.uri);
        if (event.type === FileChangeType.Deleted && insideLwcWatchedDirectory) {
            const { dir, name, ext } = parse(event.uri);
            const folder = basename(dir);
            const parentFolder = basename(dirname(dir));
            // LWC component OR folder deletion, subdirectory of lwc or lwc directory itself
            if (((ext.endsWith('.ts') || ext.endsWith('.js')) && folder === name && parentFolder === 'lwc') || (!ext && (folder === 'lwc' || name === 'lwc'))) {
                return true;
            }
        }
    }
    return false;
}

export function isLWCRootDirectoryCreated(context: BaseWorkspaceContext, changes: FileEvent[]): boolean {
    for (const event of changes) {
        if (event.type === FileChangeType.Created && isLWCRootDirectory(context, event.uri)) {
            return true;
        }
    }
    return false;
}

export function isAuraRootDirectoryCreated(context: BaseWorkspaceContext, changes: FileEvent[]): boolean {
    for (const event of changes) {
        if (event.type === FileChangeType.Created && isAuraDirectory(context, event.uri)) {
            return true;
        }
    }
    return false;
}

export function unixify(filePath: string): string {
    return filePath.replace(/\\/g, '/');
}

export function relativePath(from: string, to: string): string {
    return unixify(relative(from, to));
}

export function pathStartsWith(path: string, root: string): boolean {
    if (process.platform === 'win32') {
        return path.toLowerCase().startsWith(root.toLowerCase());
    }
    return path.startsWith(root);
}

export function getExtension(textDocument: TextDocument): string {
    const filePath = URI.parse(textDocument.uri).fsPath;
    return filePath ? extname(filePath) : '';
}

export function getBasename(textDocument: TextDocument): string {
    const filePath = URI.parse(textDocument.uri).fsPath;
    const ext = extname(filePath);
    return filePath ? basename(filePath, ext) : '';
}

export function getSfdxResource(resourceName: string): string {
    return join(__dirname, RESOURCES_DIR, 'sfdx', resourceName);
}

export function getCoreResource(resourceName: string): string {
    return join(__dirname, RESOURCES_DIR, 'core', resourceName);
}

export async function appendLineIfMissing(file: string, line: string): Promise<void> {
    if (!(await fs.pathExists(file))) {
        return fs.writeFile(file, line + '\n');
    } else if (!(await fileContainsLine(file, line))) {
        return fs.appendFile(file, '\n' + line + '\n');
    }
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
                if (!toArray.some((value) => equal(value, e))) {
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
        } else if (fromVal !== null && typeof fromVal === 'object') {
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

export const memoize = (fn: any): any => {
    let cache: any;
    return (): any => {
        if (cache) {
            return cache;
        }
        cache = fn.apply(this);
        return cache;
    };
};

export function readJsonSync(file: string): any {
    const exists = fs.pathExistsSync(file);
    try {
        // jsonc.parse will return an object without comments.
        // Comments will be lost if this object is written back to file.
        // Individual properties should be updated directly via VS Code API to preserve comments.
        return exists ? jsonc.parse(fs.readFileSync(file, 'utf8')) : {};
    } catch (err) {
        console.log(`onIndexCustomComponents(LOTS): Error reading jsconfig ${file}`, err);
    }
}

export function writeJsonSync(file: string, json: any): any {
    fs.writeJSONSync(file, json, {
        spaces: 4,
    });
}
