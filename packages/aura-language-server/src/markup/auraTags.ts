import AuraIndexer from '../aura-indexer/indexer';
import { TagInfo, AttributeInfo, IHTMLTagProvider } from '@salesforce/lightning-lsp-common';

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

export function getAuraTagProvider(): IHTMLTagProvider {
    function addTags(collector: (tag: string, label: string, info: TagInfo) => void): void {
        for (const [tag, tagInfo] of getAuraTags()) {
            collector(tag, tagInfo.getHover(), tagInfo);
        }
    }

    function addAttributes(tag: string, collector: (attribute: string, info: AttributeInfo, type?: string) => void): void {
        const cTag = getAuraByTag(tag);
        if (cTag) {
            for (const info of cTag.attributes) {
                collector(info.name, info, info.type);
            }
        }
    }

    function addExpressions(templateTag: string, collector: (attribute: string, info: AttributeInfo, type: string) => void): void {
        const cTag = getAuraByTag(templateTag);
        if (cTag) {
            cTag.attributes.forEach(attribute => {
                collector(attribute.name, null, null);
            });
            // cTag.methods.forEach(metadata => {
            //     collector(metadata.name, null, null);
            // });
        }
    }

    return {
        getId: (): string => 'aura',
        isApplicable: (languageId): boolean => languageId === 'html',
        collectTags: (collector: (tag: string, label: string, info: TagInfo) => void): void => {
            addTags(collector);
        },
        collectAttributes: (tag: string, collector: (attribute: string, info: AttributeInfo, type?: string) => void): void => {
            if (tag) {
                addAttributes(tag, collector);
            }
        },
        collectValues: (/*tag: string, attribute: string, collector: (value: string) => void*/): void => {
            // TODO provide suggestions by consulting shapeService
        },

        // TODO move this to ICompletionParticipant
        collectExpressionValues: (templateTag: string, collector: (value: string) => void): void => {
            addExpressions(templateTag, collector);
        },
        getTagInfo: (tag: string): TagInfo => getAuraByTag(tag),
        getGlobalAttributes: (): [] => [],
    };
}
