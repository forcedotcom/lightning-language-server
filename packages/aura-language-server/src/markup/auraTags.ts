import { IHTMLTagProvider } from '../html-language-service/parser/htmlTags';
import { Location } from 'vscode-languageserver';
import * as auraUtils from '../aura-utils';
import * as fs from 'fs';
import { TagInfo } from '../tagInfo';
import { AttributeInfo } from '../attributeInfo';
import { parse, Node } from '../html-language-service/parser/htmlParser';
import { promisify } from 'util';
import LineColumnFinder from 'line-column';
import URI from 'vscode-uri';
import { basename, parse as parsePath } from 'path';
import { getLwcTags } from 'lwc-language-server';
import changeCase from 'change-case';

const readFile = promisify(fs.readFile);

const AURA_TAGS: Map<string, TagInfo> = new Map();
const AURA_EVENTS: Map<string, TagInfo> = new Map();
const AURA_NAMESPACES: Set<string> = new Set();

export async function loadSystemTags(): Promise<void> {
    const data = await readFile(auraUtils.getAuraSystemResourcePath(), 'utf-8');
    const auraSystem = JSON.parse(data);
    for (const tag in auraSystem) {
        // TODO need to account for LWC tags here
        if (auraSystem.hasOwnProperty(tag) && typeof tag === 'string') {
            const tagObj = auraSystem[tag];
            const info = new TagInfo([]);
            if (tagObj.attributes) {
                tagObj.attributes.map((a: any) => {
                    // TODO - could we use more in depth doc from component library here?
                    info.attributes.push(new AttributeInfo(a.name, a.description, a.type, undefined, 'Aura Attribute'));
                });
            }
            info.documentation = tagObj.description;
            info.name = tag;
            info.namespace = tagObj.namespace;
            AURA_TAGS.set(tag, info);
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
            const info = new TagInfo([]);
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
            AURA_NAMESPACES.add(tagObj.namespace);
            if (tagObj.type === 'event') {
                AURA_EVENTS.set(tag, info);
            } else {
                AURA_TAGS.set(tag, info);
            }
        }
    }
}

function searchAura(node: Node): Node[] {
    const results = [];
    if (node.tag.indexOf(':') != -1) {
        results.push(node);
    }
    for (const child of node.children) {
        results.push(...searchAura(child));
    }
    return results;
}

function trimQuotes(string: string) {
    if (!string) {
        return '';
    }
    return string.replace(/"([^"]+(?="))"/g, '$1');
}

function getTagInfo(file: string, contents: string, node: Node): TagInfo {
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
    const name = 'c:' + parsePath(basename(file)).name;
    const info = new TagInfo([], location, documentation, name, 'c');
    return info;
}
export async function parseMarkup(file: string): Promise<TagInfo> {
    const markup = await readFile(file, 'utf-8');
    const result = parse(markup);
    const tags = [];
    for (const root of result.roots) {
        tags.push(...searchAura(root));
    }

    const tagInfo = getTagInfo(file, markup, result.roots[0]);

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

    AURA_TAGS.set(tagInfo.name, tagInfo);

    console.log(file);
    return tagInfo;
}



export function isAuraNamespace(namespace: string): boolean {
    return AURA_NAMESPACES.has(namespace);
}

export function getAuraTags(): Map<string, TagInfo> {
    const tags = getLwcTags();
    const filtered: Map<string, TagInfo> = new Map();
    for (const [tag, tagInfo] of tags) {
        // TODO: MAKE THIS LAZY FOR PERFORMANCE
        if (tag.startsWith('c')) {
            const interopTagInfo = JSON.parse(JSON.stringify(tagInfo));

            const name = tag
                .split('-')
                .slice(1)
                .join('-');
            interopTagInfo.name = ['c', changeCase.camelCase(name)].join(':');

            const attrs: AttributeInfo[] = [];
            for (const attribute of interopTagInfo.attributes) {
                const attrname = changeCase.camelCase(attribute.jsName);
                attrs.push( new AttributeInfo(attrname, attribute.documentation, attribute.type, attribute.Location, ''));
            }

            const info = new TagInfo(attrs, interopTagInfo.location, interopTagInfo.documentation, interopTagInfo.name, 'c');

            filtered.set(interopTagInfo.name, info);
        }
    }
    const map = new Map([...AURA_TAGS, ...filtered]);
    return map;
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
