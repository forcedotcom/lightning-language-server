import { IHTMLTagProvider } from './htmlTags';
import { getlwcStandardResourcePath } from '../../utils';
import * as fs from "fs"
import { CompletionItem } from 'vscode-languageserver';

interface TagInfo {
    attributes: string[];
}

let lwcTags: Map<string, TagInfo> = new Map();

class LwcCompletionItem implements CompletionItem {
    constructor(
        readonly label: string,
        readonly documentation: string,
    ) {}
}

const LWC_DIRECTIVES: LwcCompletionItem[] = [
    new LwcCompletionItem(
        'for:each',
        'Renders the element or template block multiple times based on the expression value.'
    ),
    new LwcCompletionItem(
        'for:item',
        'Bind the current iteration item to an identifier.'
    ),
    new LwcCompletionItem(
        'for:index',
        'Bind the current iteration index to an identifier.'
    ),
    new LwcCompletionItem(
        'if:true',
        'Renders the element or template if the expression value is thruthy.'
    ),
    new LwcCompletionItem(
        'if:false',
        'Renders the element or template if the expression value is falsy.'
    ),
];

export function indexLwc(){
    loadStandardLwc();
}

function loadStandardLwc(){
    let lwcStandard = JSON.parse(fs.readFileSync(getlwcStandardResourcePath(), 'utf8'));
    for (let property in lwcStandard) {
        if (lwcStandard.hasOwnProperty(property) && typeof property === 'string') {
            let val:TagInfo = {attributes:[]};
            if(lwcStandard[property].attributes){
                lwcStandard[property].attributes.map((a:any) => {
                    var attrName = a.name.replace(/([A-Z])/g, (match: string) => `-${match.toLowerCase()}`);
                    val.attributes.push(attrName);
                });
            }
            lwcTags.set('lightning-'+property, val);
        }
    }
}

export function getLwcTagProvider() : IHTMLTagProvider {
    function addTags(collector: (tag: string, label: string) => void){
        for(let tag of lwcTags.keys()){
            collector(tag, tag);
        }
    }

    function addAttributes(tag: string, collector: (attribute: string, type: string) => void){
        let cTag = lwcTags.get(tag);
        if(cTag){
            cTag.attributes.map((a) => {
                collector(a, '');
            });
        }
    }

    function addDirectives(collector: (attribute: string, type: string) => void){
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
			//TODO provide suggestions by consulting shapeService
		}
	};
}