import { IHTMLTagProvider } from '../html-language-service/parser/htmlTags';
import * as utils from '../utils';
import * as fs from 'fs';
import * as path from 'path';
import { TagInfo } from '../tagInfo';
import { AttributeInfo } from '../attributeInfo';

const AURA_TAGS: Map<string, TagInfo> = new Map();

export function loadStandardComponents(): Promise<void> {
    return new Promise((resolve, reject) => {
        fs.readFile(utils.getAuraStandardResourcePath(), { encoding: 'utf8' }, (err, data) => {
            if (err) {
                reject(err);
            } else {
                try {
                    const auraStandard = JSON.parse(data);
                    for (const tag in auraStandard) {
                        // TODO need to account for LWC tags here
                        if (auraStandard.hasOwnProperty(tag) && typeof tag === 'string') {
                            const info = new TagInfo([]);
                            if (auraStandard[tag].attributes) {
                                auraStandard[tag].attributes.map((a: any) => {
                                    // TODO - could we use more in depth doc from component library here?
                                    info.attributes.push(new AttributeInfo(a.name, a.description, a.type, undefined, 'AURA standard attribute'));
                                });
                            }
                            info.documentation = auraStandard[tag].description;
                            info.name = tag;
                            AURA_TAGS.set(tag, info);
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

export function loadSystemTags(): Promise<void> {
    return new Promise((resolve, reject) => {
        fs.readFile(utils.getAuraSystemResourcePath(), { encoding: 'utf8' }, (err, data) => {
            if (err) {
                reject(err);
            } else {
                try {
                    const auraSystem = JSON.parse(data);
                    for (const tag in auraSystem) {
                        // TODO need to account for LWC tags here
                        if (auraSystem.hasOwnProperty(tag) && typeof tag === 'string') {
                            const info = new TagInfo([]);
                            if (auraSystem[tag].attributes) {
                                const temp = auraSystem[tag].attributes;
                                for (const v in temp) {
                                    if (temp.hasOwnProperty(v)) {
                                        const a = temp[v];
                                        info.attributes.push(new AttributeInfo(a, a.description, a.type, undefined, 'AURA standard attribute'));
                                    }
                                }
                            }
                            info.documentation = auraSystem[tag].description;
                            info.name = tag;
                            AURA_TAGS.set(tag, info);
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

export function getAuraTags(): Map<string, TagInfo> {
    return AURA_TAGS;
}

export function getAuraByTag(tag: string): TagInfo {
    return AURA_TAGS.get(tag);
}

export function getAuraTagProvider(): IHTMLTagProvider {
    function addTags(collector: (tag: string, label: string) => void) {
        for (const [tag, tagInfo] of getAuraTags()) {
            collector(tag, tagInfo.documentation);
        }
    }

    function addAttributes(tag: string, collector: (attribute: string, type?: string) => void) {
        const cTag = getAuraByTag(tag);
        if (cTag) {
            cTag.attributes.map(info => {
                collector(info.name, info.type);
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
        collectTags: (collector: (tag: string, label: string) => void) => {
            addTags(collector);
        },
        collectAttributes: (tag: string, collector: (attribute: string, type?: string) => void) => {
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
