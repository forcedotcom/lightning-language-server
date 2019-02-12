import AuraIndexer from '../aura-indexer/indexer';
import { TagInfo, AttributeInfo, IHTMLTagProvider} from 'lightning-lsp-common';

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

export function setIndexer(idx: AuraIndexer) {
    indexer = idx;
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
