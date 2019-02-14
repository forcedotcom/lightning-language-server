import { IHTMLTagProvider } from 'lightning-lsp-common';
import { Location } from 'vscode-languageserver';
import * as auraUtils from '../aura-utils';
import * as fs from 'fs';
import { TagInfo } from 'lightning-lsp-common';
import { AttributeInfo, componentUtil } from 'lightning-lsp-common';
// TODO not sure if we want to be exposing these or not
import { parse, Node } from 'lightning-lsp-common';
import { promisify } from 'util';
import LineColumnFinder from 'line-column';
import URI from 'vscode-uri';
import { basename, parse as parsePath } from 'path';
import { tagEvents as lwcTagEvents } from 'lwc-language-server';
import changeCase from 'change-case';

import EventsEmitter from 'events';

const readFile = promisify(fs.readFile);

const AURA_TAGS: Map<string, TagInfo> = new Map();
const AURA_EVENTS: Map<string, TagInfo> = new Map();
const AURA_NAMESPACES: Set<string> = new Set();

export const tagEvents = new EventsEmitter();
lwcTagEvents.on('clear', () => {
    // don't propogate this one
});
lwcTagEvents.on('delete', (tag: string) => {
    const transformedName = transformLwcTagName(tag);
    const auraName = [transformedName.namespace, transformedName.name].join(':');

    deleteCustomTag(auraName);
});
lwcTagEvents.on('set', (tagInfo: TagInfo) => {
    const tag = tagInfo.name;
    if (!tag.startsWith('lightning')) {
        const interopTagInfo = transformLwcTagToAura(tag, tagInfo);
        setCustomTag(interopTagInfo);
    }
});
export async function resetIndexes() {
    AURA_TAGS.clear();
    AURA_EVENTS.clear();

    tagEvents.emit('clear');
}

export function clearTagsforDirectory(directory: string, sfdxProject: boolean) {
    const name = componentUtil.componentFromDirectory(directory, sfdxProject);
    deleteCustomTag(name);
}

function clearTagsforFile(file: string, sfdxProject: boolean) {
    const name = componentUtil.componentFromFile(file, sfdxProject);
    deleteCustomTag(name);
}

function deleteCustomTag(tag: string) {
    AURA_TAGS.delete(tag);
    AURA_EVENTS.delete(tag);

    tagEvents.emit('delete', tag);
}
function setAuraNamespaceTag(namespace: string) {
    if (!AURA_NAMESPACES.has(namespace)) {
        AURA_NAMESPACES.add(namespace);
        tagEvents.emit('set-namespace', namespace);
    }
}

function setCustomEventTag(info: TagInfo) {
    setAuraNamespaceTag(info.namespace);
    AURA_EVENTS.set(info.name, info);
    tagEvents.emit('set', info);
}

function setCustomTag(info: TagInfo) {
    setAuraNamespaceTag(info.namespace);
    AURA_TAGS.set(info.name, info);
    tagEvents.emit('set', info);
}

export async function loadSystemTags(): Promise<void> {
    const data = await readFile(auraUtils.getAuraSystemResourcePath(), 'utf-8');
    const auraSystem = JSON.parse(data);
    for (const tag in auraSystem) {
        // TODO need to account for LWC tags here
        if (auraSystem.hasOwnProperty(tag) && typeof tag === 'string') {
            const tagObj = auraSystem[tag];
            const info = new TagInfo(null, false, []);
            if (tagObj.attributes) {
                tagObj.attributes.map((a: any) => {
                    // TODO - could we use more in depth doc from component library here?
                    info.attributes.push(new AttributeInfo(a.name, a.description, a.type, undefined, 'Aura Attribute'));
                });
            }
            info.documentation = tagObj.description;
            info.name = tag;
            info.namespace = tagObj.namespace;

            setCustomTag(info);
        }
    }
}

export async function loadStandardComponents(): Promise<void> {
    const data = await readFile(auraUtils.getAuraStandardResourcePath(), 'utf-8');
    const auraStandard = JSON.parse(data);
    for (const tag in auraStandard) {
        // TODO need to account for LWC tags here
        if (auraStandard.hasOwnProperty(tag) && typeof tag === 'string') {
            const tagObj = auraStandard[tag];
            const info = new TagInfo(null, false, []);
            if (tagObj.attributes) {
                tagObj.attributes.map((a: any) => {
                    // TODO - could we use more in depth doc from component library here?
                    info.attributes.push(new AttributeInfo(a.name, a.description, a.type, undefined, 'Aura Attribute'));
                });
            }
            info.documentation = tagObj.description;
            info.name = tag;
            info.namespace = tagObj.namespace;

            // Update our in memory maps
            // TODO should we move interfaces/apps/etc to a separate map also?
            if (tagObj.type === 'event') {
                setCustomEventTag(info);
            } else {
                setCustomTag(info);
            }
        }
    }
}

function searchAura(node: Node): Node[] {
    const results = [];
    if (node.tag.indexOf(':') !== -1) {
        results.push(node);
    }
    for (const child of node.children) {
        results.push(...searchAura(child));
    }
    return results;
}

function trimQuotes(str: string) {
    if (!str) {
        return '';
    }
    return str.replace(/"([^"]+(?="))"/g, '$1');
}

function getTagInfo(file: string, sfdxProject: boolean, contents: string, node: Node): TagInfo {
    if (!node) {
        return;
    }
    const attributes = node.attributes || {};
    const documentation = trimQuotes(attributes.description);

    const startColumn = new LineColumnFinder(contents).fromIndex(node.start);
    const endColumn = new LineColumnFinder(contents).fromIndex(node.end - 1);

    const location: Location = {
        uri: URI.file(file).toString(),
        range: {
            start: {
                line: startColumn.line,
                character: startColumn.col,
            },
            end: {
                line: endColumn.line,
                character: endColumn.col,
            },
        },
    };
    const name = componentUtil.componentFromFile(file, sfdxProject);
    const info = new TagInfo(file, false, [], location, documentation, name, 'c');
    return info;
}

export async function parseMarkup(file: string, sfdxProject: boolean): Promise<TagInfo | undefined> {
    // console.log(file);

    if (!fs.existsSync(file)) {
        clearTagsforFile(file, sfdxProject);
        return;
    }
    const markup = await readFile(file, 'utf-8');
    const result = parse(markup);
    const tags = [];
    for (const root of result.roots) {
        tags.push(...searchAura(root));
    }

    const tagInfo = getTagInfo(file, sfdxProject, markup, result.roots[0]);
    if (!tagInfo) {
        clearTagsforFile(file, sfdxProject);
        return;
    }
    const attributeInfos = tags
        .filter(tag => tag.tag.startsWith('aura:attribute'))
        .map(node => {
            const attributes = node.attributes || {};
            const documentation = trimQuotes(attributes.description);
            const jsName = trimQuotes(attributes.name);
            const type = trimQuotes(attributes.type);
            const startColumn = new LineColumnFinder(markup).fromIndex(node.start);
            const endColumn = new LineColumnFinder(markup).fromIndex(node.end - 1);

            const location: Location = {
                uri: URI.file(file).toString(),
                range: {
                    start: {
                        line: startColumn.line,
                        character: startColumn.col,
                    },
                    end: {
                        line: endColumn.line,
                        character: endColumn.col,
                    },
                },
            };

            return new AttributeInfo(jsName, documentation, type, location);
        });
    tagInfo.attributes = attributeInfos;
    setCustomTag(tagInfo);
    return tagInfo;
}

export function isAuraNamespace(namespace: string): boolean {
    return AURA_NAMESPACES.has(namespace);
}

function transformLwcTagName(tag: string) {
    const namespace = tag.split('-')[0];
    const name = tag
        .split('-')
        .slice(1)
        .join('-');
    return {
        namespace,
        name: changeCase.camelCase(name),
    };
}
function transformLwcTagToAura(tag: string, tagInfo: any): TagInfo {
    const interopTagInfo = JSON.parse(JSON.stringify(tagInfo));

    const transformedName = transformLwcTagName(tag);
    interopTagInfo.name = [transformedName.namespace, transformedName.name].join(':');

    const attrs: AttributeInfo[] = [];
    for (const attribute of interopTagInfo.attributes) {
        const attrname = changeCase.camelCase(attribute.jsName || attribute.name);
        attrs.push(new AttributeInfo(attrname, attribute.documentation, attribute.type, attribute.Location, ''));
    }

    const info = new TagInfo(
        interopTagInfo.file,
        true,
        attrs,
        interopTagInfo.location,
        interopTagInfo.documentation,
        interopTagInfo.name,
        transformedName.namespace,
    );
    return info;
}

export function getAuraTags(): Map<string, TagInfo> {
    return AURA_TAGS;
}

export function getAuraNamespaces(): string[] {
    return [...AURA_NAMESPACES];
}

export function getAuraByTag(tag: string): TagInfo {
    return getAuraTags().get(tag);
}

export function getAuraTagProvider(): IHTMLTagProvider {
    function addTags(collector: (tag: string, label: string, info: TagInfo) => void) {
        for (const [tag, tagInfo] of getAuraTags()) {
            collector(tag, tagInfo.getHover(), tagInfo);
        }
    }

    function addAttributes(tag: string, collector: (attribute: string, info: AttributeInfo, type?: string) => void) {
        const cTag = getAuraByTag(tag);
        if (cTag) {
            cTag.attributes.map(info => {
                collector(info.name, info, info.type);
            });
        }
    }

    function addExpressions(templateTag: string, collector: (attribute: string, info: AttributeInfo, type: string) => void) {
        const cTag = getAuraByTag(templateTag);
        // if (cTag) {
        //     cTag.properties.forEach(metadata => {
        //         collector(metadata.name, null, null);
        //     });
        //     cTag.methods.forEach(metadata => {
        //         collector(metadata.name, null, null);
        //     });
        // }
        // TODO
    }

    function addDirectives(collector: (attribute: string, info: AttributeInfo, type: string) => void) {
        // TODO
    }

    return {
        getId: () => 'aura',
        isApplicable: languageId => languageId === 'html',
        collectTags: (collector: (tag: string, label: string, info: TagInfo) => void) => {
            addTags(collector);
        },
        collectAttributes: (tag: string, collector: (attribute: string, info: AttributeInfo, type?: string) => void) => {
            // addDirectives(collector);
            if (tag) {
                addAttributes(tag, collector);
            }
        },
        collectValues: (/*tag: string, attribute: string, collector: (value: string) => void*/) => {
            // TODO provide suggestions by consulting shapeService
        },
    };
}
