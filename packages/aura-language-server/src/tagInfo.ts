import { Location } from 'vscode-languageserver';
import { AttributeInfo } from './attributeInfo';

export class TagInfo {
    constructor(
        public attributes: AttributeInfo[],
        public location?: Location,
        public documentation?: string,
        public name?: string, // properties/methods in the associated .js file: // TODO public properties?: ClassMember[], public methods?: ClassMember[],
    ) {
        this.attributes=attributes;
        this.location=location;
        this.documentation=documentation;
        this.name=name;
    }
    public getAttributeInfo(attribute: string): AttributeInfo | null {
        attribute = attribute.toLowerCase();
        for (const info of this.attributes) {
            if (attribute === info.name.toLowerCase()) {
                return info;
            }
        }
        return null;
    }
}
