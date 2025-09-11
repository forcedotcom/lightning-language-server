import { compileSource, extractAttributes, getMethods, toVSCodeRange } from './javascript/compiler';
import * as fs from 'fs';
import * as glob from 'fast-glob';
import camelcase from 'camelcase';
import { paramCase } from 'change-case';

import { URI } from 'vscode-uri';
import * as path from 'path';
import { Location, Position, Range } from 'vscode-languageserver';
import { Metadata } from './decorators';
import { ClassMember } from '@salesforce/lightning-lsp-common';
import { AttributeInfo } from '@salesforce/lightning-lsp-common/lib/indexer/attributeInfo';

export type TagAttrs = {
    file?: string;
    metadata?: Metadata;
    updatedAt?: Date;
};

// Type definition for Tag data structure
export type Tag = {
    file: string;
    metadata: Metadata;
    updatedAt: Date;
    _allAttributes?: { publicAttributes: AttributeInfo[]; privateAttributes: AttributeInfo[] } | null;
    _properties?: ClassMember[] | null;
    _methods?: ClassMember[] | null;
};

const attributeDoc = (attribute: AttributeInfo): string => {
    const { name, type, documentation } = attribute;

    if (name && type && documentation) {
        return `- **${name}**: *${type}* ${documentation}`;
    }

    if (name && type) {
        return `- **${name}**: *${type}*`;
    }

    if (name) {
        return `- **${name}**`;
    }

    return '';
};

const methodDoc = (method: ClassMember): string => {
    const { name, doc } = method;

    if (name && doc) {
        return `- **${name}()** *: ${doc}`;
    }
    if (name) {
        return `- **${name}()**`;
    }
    return '';
};

// Utility function to create Tag
export const createTag = (attributes: TagAttrs): Tag => {
    const file = attributes.file;
    const metadata = attributes.metadata;
    let updatedAt: Date;

    if (attributes.updatedAt) {
        updatedAt = new Date(attributes.updatedAt);
    } else if (file) {
        const data = fs.statSync(file);
        updatedAt = data.mtime;
    } else {
        updatedAt = new Date();
    }

    return {
        file,
        metadata,
        updatedAt,
        _allAttributes: null,
        _properties: null,
        _methods: null,
    };
};

// Utility function to get tag name
export const getTagName = (tag: Tag): string => {
    return path.parse(tag.file).name;
};

// Utility function to get aura name
export const getAuraName = (tag: Tag): string => {
    return 'c:' + camelcase(getTagName(tag));
};

// Utility function to get LWC name
export const getLwcName = (tag: Tag): string => {
    const name = getTagName(tag);
    if (name.includes('_')) {
        return 'c-' + name;
    } else {
        return 'c-' + paramCase(name);
    }
};

// Utility function to get LWC typings name
export const getLwcTypingsName = (tag: Tag): string => {
    return 'c/' + getTagName(tag);
};

// Utility function to get tag URI
export const getTagUri = (tag: Tag): string => {
    return URI.file(path.resolve(tag.file)).toString();
};

// Utility function to get all attributes
const getAllAttributes = (tag: Tag): { publicAttributes: AttributeInfo[]; privateAttributes: AttributeInfo[] } => {
    if (tag._allAttributes) {
        return tag._allAttributes;
    }
    const allAttributes = extractAttributes(tag.metadata, getTagUri(tag));
    tag._allAttributes = allAttributes;
    return allAttributes;
};

// Utility function to get public attributes
export const getPublicAttributes = (tag: Tag): AttributeInfo[] => {
    return getAllAttributes(tag).publicAttributes;
};

// Utility function to get methods
const getTagMethods = (tag: Tag): ClassMember[] => {
    if (tag._methods) {
        return tag._methods;
    }
    const methods = getMethods(tag.metadata);
    tag._methods = methods;
    return methods;
};

// Utility function to get API methods
const getApiMethods = (tag: Tag): ClassMember[] => {
    return getTagMethods(tag).filter((method) => method.decorator === 'api');
};

// Utility function to get tag range
export const getTagRange = (tag: Tag): Range => {
    if (tag.metadata.declarationLoc) {
        return toVSCodeRange(tag.metadata.declarationLoc);
    } else {
        return Range.create(Position.create(0, 0), Position.create(0, 0));
    }
};

// Utility function to get tag location
export const getTagLocation = (tag: Tag): Location => {
    return Location.create(getTagUri(tag), getTagRange(tag));
};

// Utility function to get all locations
export const getAllLocations = (tag: Tag): Location[] => {
    const { dir, name } = path.parse(tag.file);

    const convertFileToLocation = (file: string): Location => {
        const uri = URI.file(path.resolve(file)).toString();
        const position = Position.create(0, 0);
        const range = Range.create(position, position);
        return Location.create(uri, range);
    };

    const filteredFiles = glob.sync(`${dir}/${name}.+(html|css)`);
    const locations = filteredFiles.map(convertFileToLocation);
    locations.unshift(getTagLocation(tag));

    return locations;
};

// Utility function to find attribute by name
const findAttribute = (tag: Tag, name: string): AttributeInfo | null => {
    return getPublicAttributes(tag).find((attr) => attr.name === name) || null;
};

// Utility function to find class member by name
export const findClassMember = (tag: Tag, name: string): ClassMember | null => {
    return tag.metadata.classMembers?.find((item) => item.name === name) || null;
};

// Utility function to get class members (alias for metadata.classMembers)
export const getClassMembers = (tag: Tag): ClassMember[] => {
    return tag.metadata.classMembers || [];
};

// Utility function to find attribute by name (alias for findAttribute)
export const getAttribute = (tag: Tag, name: string): AttributeInfo | null => {
    return findAttribute(tag, name);
};

// Utility function to get class member location
export const getClassMemberLocation = (tag: Tag, name: string): Location | null => {
    const classMember = findClassMember(tag, name);
    if (!classMember) {
        console.log(`Attribute "${name}" not found`);
        return null;
    }
    return Location.create(getTagUri(tag), toVSCodeRange(classMember?.loc));
};

// Utility function to get tag description
export const getTagDescription = (tag: Tag): string => {
    const docs: string[] = [getTagDocumentation(tag), getAttributeDocs(tag), getMethodDocs(tag)];
    return docs.filter((item) => item !== null).join('\n');
};

// Utility function to get tag documentation
const getTagDocumentation = (tag: Tag): string => {
    return tag.metadata.doc;
};

// Utility function to get attribute docs
export const getAttributeDocs = (tag: Tag): string | null => {
    const publicAttributes = getPublicAttributes(tag);
    if (publicAttributes.length === 0) {
        return null;
    }
    return ['### Attributes', ...publicAttributes.map(attributeDoc)].join('\n');
};

// Utility function to get method docs
export const getMethodDocs = (tag: Tag): string | null => {
    const apiMethods = getApiMethods(tag);
    if (apiMethods.length === 0) {
        return null;
    }
    return ['### Methods', ...apiMethods.map(methodDoc)].join('\n');
};

// Utility function to update tag metadata
export const updateTagMetadata = (tag: Tag, meta: any): void => {
    tag.metadata = meta;
    tag._allAttributes = null;
    tag._methods = null;
    tag._properties = null;
    const data = fs.statSync(tag.file);
    tag.updatedAt = data.mtime;
};

// Standalone function to create tag from file (replaces static fromFile method)
export const createTagFromFile = async (file: string, updatedAt?: Date): Promise<Tag> | null => {
    if (file === '' || file.length === 0) {
        return null;
    }
    const filePath = path.parse(file);
    const fileName = filePath.base;
    const data = await fs.promises.readFile(file, 'utf-8');
    if (!(data.includes(`from "lwc"`) || data.includes(`from 'lwc'`))) {
        return null;
    }
    const { metadata, diagnostics } = await compileSource(data, fileName);
    if (diagnostics.length > 0) {
        console.log(`Could not create Tag from ${file}.\n${diagnostics}`);
        return null;
    }
    return createTag({ file, metadata, updatedAt });
};
