import { IHTMLTagProvider } from './htmlTags';
import { getlwcStandardResourcePath } from '../../utils';
import * as fs from "fs"

interface TagInfo {
    attributes: string[];
}

let lwcTags: Map<string, TagInfo> = new Map();
const DIRECTIVES = ["for:each" ,"for:item", "for:index" , "if:true"];

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
        DIRECTIVES.map(d => {
            collector(d, '');
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