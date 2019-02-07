import * as fs from 'fs';
import * as path from 'path';
import { FileChangeType, FileEvent, Location, Position, Range } from 'vscode-languageserver';
import URI from 'vscode-uri';
import { onCreatedCustomComponent, onDeletedCustomComponent, onIndexCustomComponents } from '../config';
import { WorkspaceContext, AttributeInfo, TagInfo } from 'lightning-lsp-common';
import { compileFile, extractAttributes, getMethods, getProperties, toVSCodeRange } from '../javascript/compiler';
import { Metadata } from '@lwc/babel-plugin-component';
import { utils, shared, componentUtil } from 'lightning-lsp-common';
import { join } from 'path';
import { promisify } from 'util';
import EventsEmitter from 'events';
import { toResolvedPath } from 'lightning-lsp-common/lib/utils';

const { WorkspaceType } = shared;
const LWC_TAGS: Map<string, TagInfo> = new Map();
const readFile = promisify(fs.readFile);

export const tagEvents = new EventsEmitter();

export function resetCustomComponents() {
    LWC_TAGS.clear();
    tagEvents.emit('clear');
}

function removeCustomTag(context: WorkspaceContext, tagName: string, moduleTag: string) {
    LWC_TAGS.delete(tagName);

    onDeletedCustomComponent(moduleTag, context);

    tagEvents.emit('delete', tagName);
}

function setCustomTag(context: WorkspaceContext, info: TagInfo) {
    LWC_TAGS.set(info.name, info);

    onCreatedCustomComponent(context, info.file);

    tagEvents.emit('set', info);
}

export async function updateCustomComponentIndex(updatedFiles: FileEvent[], context: WorkspaceContext) {
    const isSfdxProject = context.type === WorkspaceType.SFDX;
    for (const f of updatedFiles) {
        if (f.type === FileChangeType.Deleted && utils.isLWCWatchedDirectory(context, f.uri)) {
            const tagName = componentUtil.tagFromDirectory(f.uri, isSfdxProject);
            const moduleTag = componentUtil.moduleFromDirectory(f.uri, isSfdxProject);
            removeCustomTag(context, tagName, moduleTag);
        } else {
            const dir = URI.file(path.dirname(toResolvedPath(f.uri))).toString();
            if (utils.isLWCWatchedDirectory(context, dir)) {
                const file = URI.parse(f.uri).fsPath;
                if (componentUtil.isJSComponent(file)) {
                    if (f.type === FileChangeType.Created) {
                        addCustomTagFromFile(context, file, isSfdxProject);
                    } else if (f.type === FileChangeType.Deleted) {
                        const tagName = componentUtil.tagFromFile(file, context.type === WorkspaceType.SFDX);
                        const moduleName = componentUtil.moduleFromFile(file, context.type === WorkspaceType.SFDX);
                        removeCustomTag(context, tagName, moduleName);
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

const LWC_STANDARD: string = 'lwc-standard.json';
const RESOURCES_DIR = '../resources';

export function getlwcStandardResourcePath() {
    return join(__dirname, RESOURCES_DIR, LWC_STANDARD);
}

export async function loadStandardComponents(context: WorkspaceContext): Promise<void> {
    const data = await readFile(getlwcStandardResourcePath(), 'utf-8');
    const lwcStandard = JSON.parse(data);
    for (const tag in lwcStandard) {
        if (lwcStandard.hasOwnProperty(tag) && typeof tag === 'string') {
            const info = new TagInfo(null, true, []);
            if (lwcStandard[tag].attributes) {
                lwcStandard[tag].attributes.map((a: any) => {
                    const name = a.name.replace(/([A-Z])/g, (match: string) => `-${match.toLowerCase()}`);
                    info.attributes.push(new AttributeInfo(name, a.description, a.type, undefined, 'LWC standard attribute'));
                });
            }
            info.documentation = lwcStandard[tag].description;
            info.name = 'lightning-' + tag;
            setCustomTag(context, info);
        }
    }
}

function addCustomTag(context: WorkspaceContext, tag: string, uri: string, metadata: Metadata) {
    const doc = metadata.doc;
    const attributes = extractAttributes(metadata, uri);
    // declarationLoc may be undefined if live file doesn't extend LightningElement yet
    const range = metadata.declarationLoc ? toVSCodeRange(metadata.declarationLoc) : Range.create(Position.create(0, 0), Position.create(0, 0));
    const location = Location.create(uri, range);
    const namespace = tag.split('-')[0];
    const file = toResolvedPath(uri);
    const tagInfo = new TagInfo(file, true, attributes, location, doc, tag, namespace, getProperties(metadata), getMethods(metadata));
    setCustomTag(context, tagInfo);
}

export async function indexCustomComponents(context: WorkspaceContext): Promise<void> {
    const files = context.findAllModules();

    await loadCustomTagsFromFiles(context, files, context.type === WorkspaceType.SFDX);
    onIndexCustomComponents(context, files);
}

async function loadCustomTagsFromFiles(context: WorkspaceContext, filePaths: string[], sfdxProject: boolean) {
    const startTime = process.hrtime();
    for (const file of filePaths) {
        await addCustomTagFromFile(context, file, sfdxProject);
    }
    console.log('loadCustomTagsFromFiles: processed ' + filePaths.length + ' files in ' + utils.elapsedMillis(startTime));
}

export async function addCustomTagFromResults(context: WorkspaceContext, uri: string, metadata: Metadata, sfdxProject: boolean) {
    const tag = componentUtil.tagFromFile(URI.parse(uri).fsPath, sfdxProject);
    if (tag) {
        addCustomTag(context, tag, uri, metadata);
    }
}

export async function addCustomTagFromFile(context: WorkspaceContext, file: string, sfdxProject: boolean) {
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
                addCustomTag(context, tag, uri, metadata);
            }
        } catch (error) {
            console.log('error compiling ' + file, error);
        }
    }
}
