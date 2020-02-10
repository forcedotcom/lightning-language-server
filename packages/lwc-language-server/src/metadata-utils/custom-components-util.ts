import * as fs from 'fs-extra';
import * as path from 'path';
import { FileChangeType, FileEvent, Location, Position, Range } from 'vscode-languageserver';
import URI from 'vscode-uri';
import { onSetCustomComponent, onDeletedCustomComponent, onIndexCustomComponents } from '../config';
import { WorkspaceContext, AttributeInfo, TagInfo } from '@salesforce/lightning-lsp-common';
import { compileFile, extractAttributes, getMethods, getProperties, toVSCodeRange } from '../javascript/compiler';
import { Metadata } from '@lwc/babel-plugin-component';
import { utils, shared, componentUtil } from '@salesforce/lightning-lsp-common';
import { join } from 'path';
import EventsEmitter from 'events';
import { toResolvedPath } from '@salesforce/lightning-lsp-common/lib/utils';
import { TagType } from '@salesforce/lightning-lsp-common/lib/indexer/tagInfo';

const { WorkspaceType } = shared;

const LWC_STANDARD: string = 'lwc-standard.json';
const RESOURCES_DIR = '../resources';

const LWC_TAGS: Map<string, TagInfo> = new Map();

export const eventEmitter = new EventsEmitter();

export function resetCustomComponents() {
    LWC_TAGS.clear();
    eventEmitter.emit('clear');
}

async function removeCustomTag(context: WorkspaceContext, tagName: string, moduleTag: string, writeConfigs: boolean) {
    LWC_TAGS.delete(tagName);

    if (writeConfigs) {
        await onDeletedCustomComponent(moduleTag, context);
    }

    eventEmitter.emit('delete', tagName);
}

async function setCustomTag(context: WorkspaceContext, info: TagInfo, writeConfigs: boolean) {
    LWC_TAGS.set(info.name, info);

    if (writeConfigs) {
        await onSetCustomComponent(context, info.file);
    }

    eventEmitter.emit('set', info);
}

export async function updateCustomComponentIndex(updatedFiles: FileEvent[], context: WorkspaceContext, writeConfigs: boolean = true) {
    const isSfdxProject = context.type === WorkspaceType.SFDX;
    for (const f of updatedFiles) {
        if (f.type === FileChangeType.Deleted && utils.isLWCWatchedDirectory(context, f.uri)) {
            const tagName = componentUtil.tagFromDirectory(f.uri, isSfdxProject);
            const moduleTag = componentUtil.moduleFromDirectory(f.uri, isSfdxProject);
            await removeCustomTag(context, tagName, moduleTag, writeConfigs);
        } else {
            const dir = URI.file(path.dirname(toResolvedPath(f.uri))).toString();
            if (utils.isLWCWatchedDirectory(context, dir)) {
                const file = URI.parse(f.uri).fsPath;
                if (componentUtil.isJSComponent(file)) {
                    if (f.type === FileChangeType.Created) {
                        await addCustomTagFromFile(context, file, isSfdxProject, writeConfigs);
                    } else if (f.type === FileChangeType.Deleted) {
                        const tagName = componentUtil.tagFromFile(file, context.type === WorkspaceType.SFDX);
                        const moduleName = componentUtil.moduleFromFile(file, context.type === WorkspaceType.SFDX);
                        await removeCustomTag(context, tagName, moduleName, writeConfigs);
                    }
                }
            }
        }
    }
}

export function getLwcTags(): Map<string, TagInfo> {
    return LWC_TAGS;
}

export function getLwcByTag(tag: string): TagInfo {
    return LWC_TAGS.get(tag);
}

export function getlwcStandardResourcePath() {
    return join(__dirname, RESOURCES_DIR, LWC_STANDARD);
}

export async function loadStandardComponents(context: WorkspaceContext, writeConfigs: boolean = true): Promise<void> {
    const data = await fs.readFile(getlwcStandardResourcePath(), 'utf-8');
    const lwcStandard = JSON.parse(data);
    for (const tag in lwcStandard) {
        if (lwcStandard.hasOwnProperty(tag) && typeof tag === 'string') {
            const info = new TagInfo(null, TagType.STANDARD, true, []);
            if (lwcStandard[tag].attributes) {
                lwcStandard[tag].attributes.map((a: any) => {
                    const name = a.name.replace(/([A-Z])/g, (match: string) => `-${match.toLowerCase()}`);
                    info.attributes.push(new AttributeInfo(name, a.description, undefined, undefined, a.type, undefined, 'LWC standard attribute'));
                });
            }
            info.documentation = lwcStandard[tag].description;
            // TODO this needs cleanup for things outside the lightning namespace
            info.name = 'lightning-' + tag;
            info.namespace = 'lightning';
            await setCustomTag(context, info, writeConfigs);
        }
    }
}

async function addCustomTag(context: WorkspaceContext, tag: string, uri: string, metadata: Metadata, writeConfigs: boolean) {
    const doc = metadata.doc;
    const attributes = extractAttributes(metadata, uri);
    const publicAttributes = attributes.publicAttributes;
    // declarationLoc may be undefined if live file doesn't extend LightningElement yet
    const range = metadata.declarationLoc ? toVSCodeRange(metadata.declarationLoc) : Range.create(Position.create(0, 0), Position.create(0, 0));
    const location = Location.create(uri, range);
    const namespace = tag.split('-')[0];
    const file = toResolvedPath(uri);
    const tagInfo = new TagInfo(file, TagType.CUSTOM, true, publicAttributes, location, doc, tag, namespace, getProperties(metadata), getMethods(metadata));
    await setCustomTag(context, tagInfo, writeConfigs);
}

export async function indexCustomComponents(context: WorkspaceContext, writeConfigs: boolean = true): Promise<void> {
    const files = await context.findAllModules();

    // writeConfigs is set to false to avoid updating config twice for the same tag.
    // loadCustomTagsFromFiles and onIndexCustomComponents lead to the same config updates.
    await loadCustomTagsFromFiles(context, files, context.type === WorkspaceType.SFDX, false);
    if (writeConfigs) {
        await onIndexCustomComponents(context, files);
    }
}

async function loadCustomTagsFromFiles(context: WorkspaceContext, filePaths: string[], sfdxProject: boolean, writeConfigs: boolean) {
    const startTime = process.hrtime();
    for (const file of filePaths) {
        await addCustomTagFromFile(context, file, sfdxProject, writeConfigs);
    }
    console.log('loadCustomTagsFromFiles: processed ' + filePaths.length + ' files in ' + utils.elapsedMillis(startTime));
}

export async function addCustomTagFromResults(context: WorkspaceContext, uri: string, metadata: Metadata, sfdxProject: boolean, writeConfigs: boolean = true) {
    const tag = componentUtil.tagFromFile(URI.parse(uri).fsPath, sfdxProject);
    if (tag) {
        await addCustomTag(context, tag, uri, metadata, writeConfigs);
    }
}

export async function addCustomTagFromFile(context: WorkspaceContext, file: string, sfdxProject: boolean, writeConfigs: boolean = true) {
    const tag = componentUtil.tagFromFile(file, sfdxProject);
    if (tag) {
        // get attributes from compiler metadata
        try {
            const { metadata, diagnostics } = await compileFile(file);
            if (diagnostics.length > 0) {
                console.log('error compiling ' + file + ': ', diagnostics);
            }
            if (metadata) {
                const uri = URI.file(path.resolve(file)).toString();
                await addCustomTag(context, tag, uri, metadata, writeConfigs);
            }
        } catch (error) {
            console.log('error compiling ' + file, error);
        }
    }
}
