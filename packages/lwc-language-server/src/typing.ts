import { parseStringPromise } from 'xml2js';

export default class Typing {
    private static allowedTypes: string[] = ['asset', 'resource', 'messageChannel', 'customLabel'];

    readonly type: string;
    readonly name: string;
    readonly fileName: string;

    constructor(attributes: any) {
        if (!Typing.allowedTypes.includes(attributes.type)) {
            const errorMessage: string = 'Cannot create a Typing with "' + attributes.type + '" type. Must be one of [' + Typing.allowedTypes.toString() + ']';

            throw new Error(errorMessage);
        }

        this.type = attributes.type;
        this.name = attributes.name;
        this.fileName = `${attributes.name}.d.ts`;
    }

    static fromMetas(metaFilenames: string[]): Typing[] {
        return metaFilenames.map(this.fromMeta);
    }

    static fromMeta(metaFilename: string): Typing {
        const regex = /(?<name>[\w-]+)\.(?<type>.+)-meta.xml$/;
        const { name, type } = regex.exec(metaFilename).groups;
        return new Typing({ name, type });
    }

    static async fromCustomLabels(xmlDocument: string): Promise<[Typing]> {
        const { CustomLabels } = await parseStringPromise(xmlDocument);
        return CustomLabels.labels.map((label: any) => {
            const name = label.fullName[0];
            const type = 'customLabel';
            return new Typing({ name, type });
        });
    }

    declaration(): string {
        let modulePath: string;
        switch (this.type) {
            case 'asset':
                modulePath = `@salesforce/contentAssetUrl/${this.name}`;
                break;
            case 'resource':
                modulePath = `@salesforce/resourceUrl/${this.name}`;
                break;
            case 'messageChannel':
                modulePath = `@salesforce/messageChannel/${this.name}__c`;
                break;
            case 'customLabel':
                modulePath = `@salesforce/label/c.${this.name}`;
                break;
            default:
                throw new Error(`${this.type} not supported`);
        }

        return `declare module "${modulePath}" {
    var ${this.name}: string;
    export default ${this.name};
}`;
    }
}
