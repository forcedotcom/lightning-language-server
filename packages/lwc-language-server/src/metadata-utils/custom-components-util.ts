import * as path from 'path';
import * as fs from 'fs';
import * as utils from '../utils';
import { FileEvent, FileChangeType, Location, Position, Range } from 'vscode-languageserver';
import { compileFile, extractAttributes } from '../javascript/compiler';
import { WorkspaceContext } from '../context';
import { WorkspaceType } from '../shared';
import URI from 'vscode-uri';
import { TagInfo, AttributeInfo } from '../html-language-service/parser/htmlTags';
import { ICompilerMetadata } from '../javascript/compiler';

const LWC_TAGS: Map<string, TagInfo> = new Map();

export async function updateCustomComponentIndex(updatedFiles: FileEvent[], { type }: WorkspaceContext) {
    const isSfdxProject = type === WorkspaceType.SFDX;
    updatedFiles.forEach(f => {
        if (f.uri.match(`.*${path.sep}lightningcomponents${path.sep}.*.js`)) {
            const file = URI.parse(f.uri).fsPath;
            if (f.type === FileChangeType.Created) {
                addCustomTagFromFile(file, isSfdxProject);
            } else if (f.type === FileChangeType.Deleted) {
                removeCustomTagFromFile(file, isSfdxProject);
            }
        }
    });
}

export function getLwcTags(): Map<string, TagInfo> {
    return LWC_TAGS;
}

export function getLwcByTag(tag: string): TagInfo {
    return LWC_TAGS.get(tag);
}

export function loadStandardComponents(): Promise<void> {
    return new Promise((resolve, reject) => {
        fs.readFile(utils.getlwcStandardResourcePath(), { encoding: 'utf8' }, (err, data) => {
            if (err) {
                reject(err);
            } else {
                try {
                    const lwcStandard = JSON.parse(data);
                    for (const tag in lwcStandard) {
                        if (lwcStandard.hasOwnProperty(tag) && typeof tag === 'string') {
                            const info = new TagInfo([]);
                            if (lwcStandard[tag].attributes) {
                                lwcStandard[tag].attributes.map((a: any) => {
                                    info.attributes.push(new AttributeInfo(a.name, a.description, undefined, 'LWC standard attribute'));
                                });
                            }
                            info.documentation = lwcStandard[tag].description;
                            LWC_TAGS.set('lightning-' + tag, info);
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

function removeCustomTag(tag: string) {
    LWC_TAGS.delete(tag);
}

export function removeAllTags() {
    LWC_TAGS.clear();
}

function addCustomTag(tag: string, uri: string, metadata: ICompilerMetadata) {
    const doc = metadata.doc;
    const attributes = extractAttributes(metadata, uri);
    // declarationLoc may be undefined if live file doesn't extend Element yet
    const startLine = metadata.declarationLoc ? metadata.declarationLoc.start.line - 1 : 0;
    const location = Location.create(uri, Range.create(Position.create(startLine, 0), Position.create(startLine, 0)));
    LWC_TAGS.set(tag, new TagInfo(attributes, location, doc));
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
    console.log('loadCustomTagsFromFiles: processed ' + filePaths.length + ' files in ' + utils.elapsedMillis(startTime));
}

export async function addCustomTagFromFile(file: string, sfdxProject: boolean) {
    const tag = tagFromFile(file, sfdxProject);
    if (tag) {
        // get attributes from compiler metadata
        try {
            const { result, diagnostics } = await compileFile(file);
            if (diagnostics.length > 0) {
                console.log('error compiling ' + file + ': ', diagnostics);
            }
            if (result) {
                const metadata = result.metadata;
                const uri = URI.file(path.resolve(file)).toString();
                addCustomTag(tag, uri, metadata);
            }
        } catch (error) {
            console.log('error compiling ' + file, error);
        }
    }
}

export function addCustomTagFromResults(uri: string, metadata: ICompilerMetadata, sfdxProject: boolean) {
    const tag = tagFromFile(URI.parse(uri).fsPath, sfdxProject);
    if (tag) {
        addCustomTag(tag, uri, metadata);
    }
}

function removeCustomTagFromFile(file: string, sfdxProject: boolean) {
    const tag = tagFromFile(file, sfdxProject);
    if (tag) {
        removeCustomTag(tag);
    }
}

/**
 * @param file path to main .js/.html for component, i.e. card/card.js or card/card.html
 * @return tag name, i.e. c-card or namespace-card, or null if not the .js/.html file for a component
 */
export function tagFromFile(file: string, sfdxProject: boolean) {
    const filePath = path.parse(file);
    const fileName = filePath.name;
    const pathElements = filePath.dir.split(path.sep);
    const parentDirName = pathElements.pop();
    if (fileName === parentDirName) {
        const namespace = sfdxProject ? 'c' : pathElements.pop();
        return tagName(namespace, parentDirName);
    }
    return null;
}

function tagName(namespace: string, tag: string) {
    if (namespace === 'interop') {
        // treat interop as lightning, i.e. needed when using extension with lightning-global
        // TODO: worth to add WorkspaceType.LIGHTNING_GLOBAL?
        namespace = 'lightning';
    }
    return namespace + '-' + tag;
}
