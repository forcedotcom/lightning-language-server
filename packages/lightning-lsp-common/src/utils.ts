import * as fs from 'fs';
import { basename, extname, join, parse, relative, resolve, dirname } from 'path';
import { TextDocument, FileEvent, FileChangeType } from 'vscode-languageserver';
import { URI } from 'vscode-uri';
import equal from 'deep-equal';
import { BaseWorkspaceContext } from './base-context';
import { WorkspaceTypes } from './shared';
import * as jsonc from 'jsonc-parser';

const RESOURCES_DIR = 'resources';

const fileContainsLine = async (file: string, expectLine: string): Promise<boolean> => {
    const trimmed = expectLine.trim();
    for (const line of (await fs.promises.readFile(file, 'utf8')).split('\n')) {
        if (line.trim() === trimmed) {
            return true;
        }
    }
    return false;
};

export const toResolvedPath = (uri: string): string => {
    return resolve(URI.parse(uri).fsPath);
};

const isLWCRootDirectory = (context: BaseWorkspaceContext, uri: string): boolean => {
    if (context.type === WorkspaceTypes.SFDX) {
        const file = toResolvedPath(uri);
        return file.endsWith('lwc');
    }
    return false;
};

const isAuraDirectory = (context: BaseWorkspaceContext, uri: string): boolean => {
    if (context.type === WorkspaceTypes.SFDX) {
        const file = toResolvedPath(uri);
        return file.endsWith('aura');
    }
    return false;
};

export const isLWCWatchedDirectory = async (context: BaseWorkspaceContext, uri: string): Promise<boolean> => {
    const file = toResolvedPath(uri);
    return await context.isFileInsideModulesRoots(file);
};

export const isAuraWatchedDirectory = async (context: BaseWorkspaceContext, uri: string): Promise<boolean> => {
    const file = toResolvedPath(uri);
    return await context.isFileInsideAuraRoots(file);
};

/**
 * @return true if changes include a directory delete
 */
// TODO This is not waiting for the response of the promise isLWCWatchedDirectory, maybe we have the same problem on includesDeletedAuraWatchedDirectory
export const includesDeletedLwcWatchedDirectory = async (context: BaseWorkspaceContext, changes: FileEvent[]): Promise<boolean> => {
    for (const event of changes) {
        if (event.type === FileChangeType.Deleted && event.uri.indexOf('.') === -1 && (await isLWCWatchedDirectory(context, event.uri))) {
            return true;
        }
    }
    return false;
};

export const includesDeletedAuraWatchedDirectory = async (context: BaseWorkspaceContext, changes: FileEvent[]): Promise<boolean> => {
    for (const event of changes) {
        if (event.type === FileChangeType.Deleted && event.uri.indexOf('.') === -1 && (await isAuraWatchedDirectory(context, event.uri))) {
            return true;
        }
    }
    return false;
};

export const containsDeletedLwcWatchedDirectory = async (context: BaseWorkspaceContext, changes: FileEvent[]): Promise<boolean> => {
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
};

export const isLWCRootDirectoryCreated = (context: BaseWorkspaceContext, changes: FileEvent[]): boolean => {
    for (const event of changes) {
        if (event.type === FileChangeType.Created && isLWCRootDirectory(context, event.uri)) {
            return true;
        }
    }
    return false;
};

export const isAuraRootDirectoryCreated = (context: BaseWorkspaceContext, changes: FileEvent[]): boolean => {
    for (const event of changes) {
        if (event.type === FileChangeType.Created && isAuraDirectory(context, event.uri)) {
            return true;
        }
    }
    return false;
};

export const unixify = (filePath: string): string => {
    return filePath.replace(/\\/g, '/');
};

export const relativePath = (from: string, to: string): string => {
    return unixify(relative(from, to));
};

export const pathStartsWith = (path: string, root: string): boolean => {
    if (process.platform === 'win32') {
        return path.toLowerCase().startsWith(root.toLowerCase());
    }
    return path.startsWith(root);
};

export const getExtension = (textDocument: TextDocument): string => {
    const filePath = URI.parse(textDocument.uri).fsPath;
    return filePath ? extname(filePath) : '';
};

export const getBasename = (textDocument: TextDocument): string => {
    const filePath = URI.parse(textDocument.uri).fsPath;
    const ext = extname(filePath);
    return filePath ? basename(filePath, ext) : '';
};

export const getSfdxResource = (resourceName: string): string => {
    return join(__dirname, RESOURCES_DIR, 'sfdx', resourceName);
};

export const getCoreResource = (resourceName: string): string => {
    return join(__dirname, RESOURCES_DIR, 'core', resourceName);
};

export const appendLineIfMissing = async (file: string, line: string): Promise<void> => {
    if (!fs.existsSync(file)) {
        return fs.promises.writeFile(file, line + '\n');
    } else if (!(await fileContainsLine(file, line))) {
        return fs.promises.appendFile(file, '\n' + line + '\n');
    }
};

/**
 * Deep merges the 'from' object into the 'to' object
 * (assumes simple JSON config objects)
 * @return true if the 'to' object was modified, false otherwise
 */
export const deepMerge = (to: object, from: object): boolean => {
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
};

/**
 * @return string showing elapsed milliseconds from start mark
 */
export const elapsedMillis = (start: [number, number]): string => {
    const elapsed = process.hrtime(start);
    return (elapsed[0] * 1000 + elapsed[1] / 1e6).toFixed(2) + ' ms';
};

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

export const readJsonSync = (file: string): any => {
    const exists = fs.existsSync(file);
    try {
        // jsonc.parse will return an object without comments.
        // Comments will be lost if this object is written back to file.
        // Individual properties should be updated directly via VS Code API to preserve comments.
        return exists ? jsonc.parse(fs.readFileSync(file, 'utf8')) : {};
    } catch (err) {
        console.log(`onIndexCustomComponents(LOTS): Error reading jsconfig ${file}`, err);
    }
};

export const writeJsonSync = (file: string, json: any): any => {
    fs.writeFileSync(file, JSON.stringify(json, null, 4));
};
