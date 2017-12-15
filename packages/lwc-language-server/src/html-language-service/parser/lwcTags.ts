import { IHTMLTagProvider } from './htmlTags';
import { CompletionItem } from 'vscode-languageserver';
import { getLwcTags, getLwcByTag } from './../../metadata-utils/custom-components-util';

class LwcCompletionItem implements CompletionItem {
    constructor(
        readonly label: string,
        readonly documentation: string,
    ) { }
}

const LWC_DIRECTIVES: LwcCompletionItem[] = [
    new LwcCompletionItem(
        'for:each',
        'Renders the element or template block multiple times based on the expression value.',
    ),
    new LwcCompletionItem(
        'for:item',
        'Bind the current iteration item to an identifier.',
    ),
    new LwcCompletionItem(
        'for:index',
        'Bind the current iteration index to an identifier.',
    ),
    new LwcCompletionItem(
        'if:true',
        'Renders the element or template if the expression value is thruthy.',
    ),
    new LwcCompletionItem(
        'if:false',
        'Renders the element or template if the expression value is falsy.',
    ),
];

export function getLwcTagProvider(): IHTMLTagProvider {
    function addTags(collector: (tag: string, label: string) => void) {
        for (const [tag, tagInfo] of getLwcTags()) {
            collector(tag, tagInfo.documentation);
        }
    }

    function addAttributes(tag: string, collector: (attribute: string, type: string) => void) {
        const cTag = getLwcByTag(tag);
        if (cTag) {
            cTag.attributes.map((a) => {
                collector(a, '');
            });
        }
    }

    function addDirectives(collector: (attribute: string, type: string) => void) {
        LWC_DIRECTIVES.map(d => {
            collector(d.label, null);
        });
    }

    return {
        getId: () => 'lwc',
        isApplicable: (languageId) => languageId === 'html',
        collectTags: (collector: (tag: string, label: string) => void) => {
            addTags(collector);
        },
        collectAttributes: (tag: string, collector: (attribute: string, type: string) => void) => {
            addDirectives(collector);
            if (tag) {
                addAttributes(tag, collector);
            }
        },
        collectValues: (/*tag: string, attribute: string, collector: (value: string) => void*/) => {
            // TODO provide suggestions by consulting shapeService
        },
    };
}
