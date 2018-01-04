import * as path from 'path';
import * as fs from 'fs';
import * as utils from '../utils';
import { FileEvent, FileChangeType, Location, Position, Range } from 'vscode-languageserver';
import { compileFile, extractAttributes } from '../javascript/compiler';
import { WorkspaceContext, WorkspaceType } from '../context';
import URI from 'vscode-uri';
import { TagInfo } from '../html-language-service/parser/htmlTags';
import { ICompilerMetadata } from '../javascript/compiler';

const LWC_TAGS: Map<string, TagInfo> = new Map();

export async function updateCustomComponentIndex(updatedFiles: FileEvent[], { type }: WorkspaceContext) {
    const isSfdxProject = type === WorkspaceType.SFDX;
    updatedFiles.forEach(f => {
        if (f.uri.match(`.*${path.sep}lightningcomponents${path.sep}.*.js`)) {
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

function removeCustomTag(namespace: string, tag: string) {
    LWC_TAGS.delete(utils.fullTagName(namespace, tag));
}

export function addCustomTag(namespace: string, tag: string, uri: string, metadata: ICompilerMetadata) {
    let doc = metadata.doc;
    if (!doc) {
        doc = 'LWC tag';
    }
    const attributes = extractAttributes(metadata);
    if (!metadata.declarationLoc) {
        console.info('no declarationLoc for ' + uri);
    }
    const startLine = metadata.declarationLoc ? metadata.declarationLoc.start.line - 1 : 0;
    const location = Location.create(uri, Range.create(Position.create(startLine, 0), Position.create(startLine, 0)));
    LWC_TAGS.set(utils.fullTagName(namespace, tag), new TagInfo(attributes, location, doc));
}

export async function indexCustomComponents(context: WorkspaceContext): Promise<void> {
    const files = context.findAllModules();
    await loadCustomTagsFromFiles(files, context.type === WorkspaceType.SFDX);
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
    const filePath = path.parse(file);
    const fileName = filePath.name;
    const pathElements = filePath.dir.split(path.sep);
    const parentDirName = pathElements.pop();
    if (fileName === parentDirName) {
        // get attributes from compiler metadata
        const { result, diagnostics } = await compileFile(file);
        if (diagnostics.length > 0) {
            console.log('error compiling ' + file + ': ', diagnostics);
        }
        if (result) {
            const metadata = result.metadata;
            const namespace = sfdxProject ? 'c' : pathElements.pop();
            const uri = URI.file(path.resolve(file)).toString();
            addCustomTag(namespace, parentDirName, uri, metadata);
        }
    }
}

export function addCustomTagFromResults(uri: string, metadata: ICompilerMetadata, sfdxProject: boolean) {
    const file = URI.parse(uri).path;
    const filePath = path.parse(file);
    const fileName = filePath.name;
    const pathElements = filePath.dir.split(path.sep);
    const parentDirName = pathElements.pop();
    if (fileName === parentDirName) {
        const namespace = sfdxProject ? 'c' : pathElements.pop();
        addCustomTag(namespace, parentDirName, uri, metadata);
    }
}

function removeCustomTagFromFile(file: string, sfdxProject: boolean) {
    const filePath = path.parse(file);
    const fileName = filePath.name;
    const pathElements = filePath.dir.split(path.sep);
    const parentDirName = pathElements.pop();
    if (fileName === parentDirName) {
        const namespace = sfdxProject ? 'c' : pathElements.pop();
        removeCustomTag(namespace, parentDirName);
    }
}
