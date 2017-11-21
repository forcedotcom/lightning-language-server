import { sep, parse } from 'path';
import { Glob } from 'glob';
import { getlwcStandardResourcePath, elapsedMillis } from './../utils';
import * as fs from "fs";
import { FileEvent, FileChangeType } from 'vscode-languageserver/lib/main';
import { compileFile, extractAttributes } from '../javascript/compiler';

export interface ITagInfo {
    attributes: string[];
}

const LWC_GLOB_PATTERN = '**/lightningcomponents/*/*.js';
export const LWC_TAGS: Map<string, ITagInfo> = new Map();

export async function indexLwc(workspacePath: string) {
    return Promise.all([
        loadStandardLwc(),
        indexCustomComponents(workspacePath),
    ]);
}

export async function updateCustomComponentIndex(updatedFiles: FileEvent[]) {
    updatedFiles.forEach(f => {
        if (f.uri.match(`.*${sep}lightningcomponents${sep}.*.js`)) {
            if (f.type === FileChangeType.Created) {
                addCustomTagFromFile(f.uri);
            } else if (f.type === FileChangeType.Deleted) {
                removeCustomTagFromFile(f.uri);
            }
        }
    });
}

export function getLwcTags() {
    return LWC_TAGS.keys();
}

export function getLwcByTag(tagName: string) {
    return LWC_TAGS.get(tagName);
}

function loadStandardLwc() {
    return new Promise((resolve, reject) => {
        fs.readFile(getlwcStandardResourcePath(), { encoding: 'utf8' }, (err, data) => {
            if (err) {
                reject(err);
            } else {
                try {
                    const lwcStandard = JSON.parse(data);
                    for (const property in lwcStandard) {
                        if (lwcStandard.hasOwnProperty(property) && typeof property === 'string') {
                            const val: ITagInfo = { attributes: [] };
                            if (lwcStandard[property].attributes) {
                                lwcStandard[property].attributes.map((a: any) => {
                                    const attrName =
                                        a.name.replace(/([A-Z])/g, (match: string) => `-${match.toLowerCase()}`);
                                    val.attributes.push(attrName);
                                });
                            }
                            LWC_TAGS.set('lightning-' + property, val);
                        }
                    }
                    resolve();
                } catch (e) {
                    reject(e);
                }
            }
        });
    });
}

function addCustomTag(tag: string, attributes: string[]) {
    LWC_TAGS.set('c-' + tag, { attributes });
}
function removeCustomTag(tag: string) {
    LWC_TAGS.delete('c-' + tag);
}

export function setCustomAttributes(tag: string, attributes: string[]) {
    LWC_TAGS.set('c-' + tag, { attributes });
}

function indexCustomComponents(workspacePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
        /* tslint:disable */
        new Glob(LWC_GLOB_PATTERN, { cwd: workspacePath, absolute: true }, async (err: Error, files: string[]) => {
            if (err) {
                console.log(`Error queing up indexing of labels. Error detatils: ${err}`);
                reject(err);
            } else {
                loadCustomTagsFromFiles(files);
                resolve();
            }
        });
        /* tslint:enable */
    });
}

function loadCustomTagsFromFiles(filePaths: string[]) {
    const startTime = process.hrtime();
    filePaths.map((file: string) => {
        addCustomTagFromFile(file);
    });
    // TODO: not including compile time, await above to get it
    console.log('loadCustomTagsFromFiles: executed in ' + elapsedMillis(startTime));
}

async function addCustomTagFromFile(file: string) {
    const filePath = parse(file);
    const fileName = filePath.name;
    const parentDirName = filePath.dir.split(sep).pop();
    if (fileName === parentDirName) {
        // get attributes from compiler metadata
        const rv = await compileFile(file);
        const attributes = rv.result ? extractAttributes(rv.result.metadata) : [];
        if (rv.diagnostics.length > 0) {
            console.log('error compiling ' + file + ': ', rv.diagnostics);
        }
        addCustomTag(parentDirName, attributes);
    }
}

function removeCustomTagFromFile(file: string) {
    const filePath = parse(file);
    const fileName = filePath.name;
    const parentDirName = filePath.dir.split(sep).pop();
    if (fileName === parentDirName) {
        removeCustomTag(parentDirName);
    }
}
