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

// Type definition for Typing data structure
export type Typing = {
    type: string;
    name: string;
    fileName: string;
};

// Allowed types constant
const ALLOWED_TYPES: string[] = ['asset', 'resource', 'messageChannel', 'customLabel'];

// Factory function to create Typing objects
export const createTyping = (attributes: { type: string; name: string }): Typing => {
    if (!ALLOWED_TYPES.includes(attributes.type)) {
        const errorMessage: string = 'Cannot create a Typing with "' + attributes.type + '" type. Must be one of [' + ALLOWED_TYPES.toString() + ']';
        throw new Error(errorMessage);
    }

    return {
        type: attributes.type,
        name: attributes.name,
        fileName: `${attributes.name}.${attributes.type}.d.ts`,
    };
};

// Utility function to create Typing from meta filename
export const fromMeta = (metaFilename: string): Typing => {
    const parsedPath = path.parse(metaFilename);
    const { name, type } = metaRegex.exec(parsedPath.name).groups;
    return createTyping({ name, type });
};

// Utility function to generate declarations from custom labels
export const declarationsFromCustomLabels = async (xmlDocument: string | Buffer): Promise<string> => {
    const doc = await new xml2js.Parser().parseStringPromise(xmlDocument);
    if (doc.CustomLabels === undefined || doc.CustomLabels.labels === undefined) {
        return '';
    }
    const declarations = doc.CustomLabels.labels.map((label: { [key: string]: string[] }) => {
        return declaration('customLabel', label.fullName[0]);
    });

    return declarations.join('\n');
};

// Utility function to get declaration for a Typing object
export const getDeclaration = (typing: Typing): string => {
    return declaration(typing.type, typing.name);
};
