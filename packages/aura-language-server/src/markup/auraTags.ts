import AuraIndexer from '../aura-indexer/indexer';
import { TagInfo } from '@salesforce/lightning-lsp-common';
import { IAttributeData, IHTMLDataProvider, IValueData } from 'vscode-html-languageservice';

let indexer: AuraIndexer;

function getAuraTags(): Map<string, TagInfo> {
    if (indexer) {
        return indexer.getAuraTags();
    }
    return new Map();
}
function getAuraByTag(tag: string): TagInfo {
    if (indexer) {
        return indexer.getAuraByTag(tag);
    }
    return undefined;
}

export function setIndexer(idx: AuraIndexer): void {
    indexer = idx;
}

function getTagsData(): { name: string; description?: string; attributes: IAttributeData[] }[] {
    return Array.from(getAuraTags()).map(([tag, tagInfo]) => ({
        name: tag,
        description: tagInfo.getHover(),
        attributes: tagInfo.attributes.map(attr => ({
            name: attr.name,
            description: attr.name,
            valueSet: attr.type
        }))
    }));
}

function getAttributesData(tag: string): IAttributeData[] {
    const cTag = getAuraByTag(tag);
    if (cTag) {
        return cTag.attributes.map(attr => ({
            name: attr.name,
            description: attr.name,
            valueSet: attr.type
        }));
    }
    return [];
}

function getValuesData(tag: string, attribute: string): IValueData[] {
    // TODO provide suggestions by consulting shapeService
    return [];
}

export function getAuraTagProvider(): IHTMLDataProvider {
    return {
        getId: (): string => 'aura',
        isApplicable: (languageId): boolean => languageId === 'html',
        provideTags: getTagsData,
        provideAttributes: getAttributesData,
        provideValues: getValuesData
    };
}
