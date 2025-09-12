import * as xml2js from 'xml2js';
import * as path from 'path';

const metaRegex = new RegExp(/(?<name>[\w-\.]+)\.(?<type>\w.+)-meta$/);

const declaration = (type: string, name: string): string => {
    let modulePath: string;
    switch (type) {
        case 'asset':
            modulePath = `@salesforce/contentAssetUrl/${name}`;
            break;
        case 'resource':
            modulePath = `@salesforce/resourceUrl/${name}`;
            break;
        case 'messageChannel':
            modulePath = `@salesforce/messageChannel/${name}__c`;
            break;
        case 'customLabel':
            modulePath = `@salesforce/label/c.${name}`;
            break;
        default:
            throw new Error(`${type} not supported`);
    }

    return `declare module "${modulePath}" {
    var ${name}: string;
    export default ${name};
}`;
};

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
        this.fileName = `${attributes.name}.${attributes.type}.d.ts`;
    }

    static fromMeta(metaFilename: string): Typing {
        const parsedPath = path.parse(metaFilename);
        const { name, type } = metaRegex.exec(parsedPath.name).groups;
        return new Typing({ name, type });
    }

    static async declarationsFromCustomLabels(xmlDocument: string | Buffer): Promise<string> {
        const doc = await new xml2js.Parser().parseStringPromise(xmlDocument);
        if (doc.CustomLabels === undefined || doc.CustomLabels.labels === undefined) {
            return '';
        }
        const declarations = doc.CustomLabels.labels.map((label: { [key: string]: string[] }) => declaration('customLabel', label.fullName[0]));

        return declarations.join('\n');
    }

    get declaration(): string {
        return declaration(this.type, this.name);
    }
}
