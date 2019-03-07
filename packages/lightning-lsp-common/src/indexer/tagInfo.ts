import { Location } from 'vscode-languageserver';
import { AttributeInfo } from './attributeInfo';
import { ClassMember } from '@lwc/babel-plugin-component';

export enum TagType {
    STANDARD,
    SYSTEM,
    CUSTOM,
}
export class TagInfo {
    constructor(
        public file: string,
        public type: TagType,
        public lwc: boolean,
        public attributes: AttributeInfo[],
        public location?: Location,
        public documentation?: string,
        public name?: string,
        public namespace?: string,
        public properties?: ClassMember[],
        public methods?: ClassMember[],
    ) {
        this.attributes = attributes;
        this.location = location;
        this.documentation = documentation;
        this.name = name;
        this.namespace = namespace;
        if (!this.documentation) {
            this.documentation = '';
        }
        this.properties = properties;
        this.methods = methods;
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

    public getHover(hideComponentLibraryLink?: boolean): string | null {
        let retVal = this.documentation + '\n' + this.getComponentLibraryLink() + '\n### Attributes\n';
        if (hideComponentLibraryLink || this.namespace === 'c' || !this.namespace) {
            retVal = this.documentation + '\n### Attributes\n';
        }
        for (const info of this.attributes) {
            retVal += this.getAttributeMarkdown(info);
            retVal += '\n';
        }

        return retVal;
    }

    public getComponentLibraryLink(): string | null {
        return '[View in Component Library](https://developer.salesforce.com/docs/component-library/bundle/' + this.name + ')';
    }

    public getAttributeMarkdown(attribute: AttributeInfo): string {
        if (attribute.name && attribute.type && attribute.documentation) {
            return '* **' + attribute.name + '**: *' + attribute.type + '* ' + attribute.documentation;
        }

        if (attribute.name && attribute.type) {
            return '* **' + attribute.name + '**: *' + attribute.type + '*';
        }

        if (attribute.name) {
            return '* **' + attribute.name + '**';
        }

        return '';
    }
}
