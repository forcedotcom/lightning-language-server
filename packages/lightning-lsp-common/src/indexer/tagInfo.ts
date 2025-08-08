import { Location } from 'vscode-languageserver';
import { AttributeInfo } from './attributeInfo';
import { ClassMember } from '../decorators';

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
        if (hideComponentLibraryLink || this.type === TagType.CUSTOM) {
            retVal = this.documentation + '\n### Attributes\n';
        }

        for (const info of this.attributes) {
            retVal += this.getAttributeMarkdown(info);
            retVal += '\n';
        }

        const methods = (this.methods && this.methods.filter((m) => m.decorator === 'api')) || [];
        if (methods.length > 0) {
            retVal += this.documentation + '\n### Methods\n';
            for (const info of methods) {
                retVal += this.getMethodMarkdown(info);
                retVal += '\n';
            }
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
    public getMethodMarkdown(method: ClassMember): string {
        if (method.name && method.doc) {
            return '* **' + method.name + '()**: ' + method.doc;
        }

        if (method.name) {
            return '* **' + method.name + '()**';
        }

        return '';
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static createFromJSON(json: any): TagInfo {
        return new TagInfo(
            json.file,
            json.type,
            json.lwc,
            json.attributes,
            json.location,
            json.documentation,
            json.name,
            json.namespace,
            json.properties,
            json.methods,
        );
    }
}
