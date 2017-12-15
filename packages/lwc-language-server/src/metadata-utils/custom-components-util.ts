import { sep, parse } from 'path';
import * as fs from 'fs';
import * as utils from '../utils';
import { FileEvent, FileChangeType } from 'vscode-languageserver';
import { compileFile, extractAttributes } from '../javascript/compiler';
import { WorkspaceContext } from '../context';

export class TagInfo {
    constructor(public attributes: string[], public documentation: string = '[doc placeholder]') {
    }
}

const LWC_TAGS: Map<string, TagInfo> = new Map();

export async function updateCustomComponentIndex(updatedFiles: FileEvent[], { isSfdxProject }: WorkspaceContext) {
    updatedFiles.forEach(f => {
        if (f.uri.match(`.*${sep}lightningcomponents${sep}.*.js`)) {
            if (f.type === FileChangeType.Created) {
                addCustomTagFromFile(f.uri, isSfdxProject);
            } else if (f.type === FileChangeType.Deleted) {
                removeCustomTagFromFile(f.uri, isSfdxProject);
            }
        }
    });
}

export function getLwcTags(): Map<string, TagInfo> {
    return LWC_TAGS;
}

export function getLwcByTag(tagName: string) {
    return LWC_TAGS.get(tagName);
}

export function loadStandardLwc(): Promise<void> {
    return new Promise((resolve, reject) => {
        fs.readFile(utils.getlwcStandardResourcePath(), { encoding: 'utf8' }, (err, data) => {
            if (err) {
                reject(err);
            } else {
                try {
                    const lwcStandard = JSON.parse(data);
                    for (const property in lwcStandard) {
                        if (lwcStandard.hasOwnProperty(property) && typeof property === 'string') {
                            const val = new TagInfo([]);
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

function addCustomTag(tag: string, attributes: string[], sfdxProject: boolean) {
    // TODO: handle namespaces
    LWC_TAGS.set(sfdxProject ? 'c-' + tag : tag, new TagInfo(attributes));
}
function removeCustomTag(tag: string, sfdxProject: boolean) {
    LWC_TAGS.delete(sfdxProject ? 'c-' + tag : tag);
}

export function setCustomAttributes(tag: string, attributes: string[], { isSfdxProject }: WorkspaceContext) {
    LWC_TAGS.set(isSfdxProject ? 'c-' + tag : tag, new TagInfo(attributes));
}

export async function indexCustomComponents(context: WorkspaceContext): Promise<void> {
    const files = context.findAllModules();
    await loadCustomTagsFromFiles(files, context.isSfdxProject);
}

async function loadCustomTagsFromFiles(filePaths: string[], sfdxProject: boolean) {
    const startTime = process.hrtime();
    for (const file of filePaths) {
        await addCustomTagFromFile(file, sfdxProject);
    }
    console.log('loadCustomTagsFromFiles: processed ' + filePaths.length + ' files in '
        + utils.elapsedMillis(startTime));
}

export async function addCustomTagFromFile(file: string, sfdxProject: boolean) {
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
        addCustomTag(parentDirName, attributes, sfdxProject);
    }
}

function removeCustomTagFromFile(file: string, sfdxProject: boolean) {
    const filePath = parse(file);
    const fileName = filePath.name;
    const parentDirName = filePath.dir.split(sep).pop();
    if (fileName === parentDirName) {
        removeCustomTag(parentDirName, sfdxProject);
    }
}
