import { compileSource, extractAttributes, getProperties, getMethods, toVSCodeRange } from './javascript/compiler';
import { ITagData } from 'vscode-html-languageservice';
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

export default class Tag implements ITagData {
    public file: string;
    public metadata: Metadata;
    public updatedAt: Date;

    private _allAttributes: { publicAttributes: AttributeInfo[]; privateAttributes: AttributeInfo[] } | null = null;
    private _properties: ClassMember[] | null = null;
    private _methods: ClassMember[] | null = null;

    constructor(attributes: TagAttrs) {
        this.file = attributes.file;
        this.metadata = attributes.metadata;
        if (attributes.updatedAt) {
            this.updatedAt = new Date(attributes.updatedAt);
        } else if (this.file) {
            const data = fs.statSync(this.file);
            this.updatedAt = data.mtime;
        }
    }

    get description(): string {
        const docs: string[] = [this.documentation, this.attributeDocs, this.methodDocs];
        return docs.filter((item) => item !== null).join('\n');
    }

    get name(): string {
        return path.parse(this.file).name;
    }

    get auraName(): string {
        return 'c:' + camelcase(this.name);
    }

    get lwcName(): string {
        if (this.name.includes('_')) {
            return 'c-' + this.name;
        } else {
            return 'c-' + paramCase(this.name);
        }
    }

    get lwcTypingsName(): string {
        return 'c/' + this.name;
    }

    get attributes(): AttributeInfo[] {
        return this.publicAttributes;
    }

    attribute(name: string): AttributeInfo | null {
        return this.attributes.find((attr) => attr.name === name) || null;
    }

    get documentation(): string {
        return this.metadata.doc;
    }

    get attributeDocs(): string | null {
        if (this.publicAttributes.length === 0) {
            return null;
        }

        return ['### Attributes', ...this.publicAttributes.map(attributeDoc)].join('\n');
    }

    get classMembers(): ClassMember[] {
        return this.metadata.classMembers;
    }

    classMember(name: string): ClassMember | null {
        return this.classMembers?.find((item) => item.name === name) || null;
    }

    classMemberLocation(name: string): Location | null {
        const classMember = this.classMember(name);
        if (!classMember) {
            console.log(`Attribute "${name}" not found`);
            return null;
        }
        return Location.create(this.uri, toVSCodeRange(classMember?.loc));
    }

    get methodDocs(): string | null {
        if (this.apiMethods.length === 0) {
            return null;
        }

        return ['### Methods', ...this.apiMethods.map(methodDoc)].join('\n');
    }

    get uri(): string {
        return URI.file(path.resolve(this.file)).toString();
    }

    get allAttributes(): { publicAttributes: AttributeInfo[]; privateAttributes: AttributeInfo[] } {
        if (this._allAttributes) {
            return this._allAttributes;
        }
        this._allAttributes = extractAttributes(this.metadata, this.uri);
        return this._allAttributes;
    }

    get publicAttributes(): AttributeInfo[] {
        return this.allAttributes.publicAttributes;
    }

    get privateAttributes(): AttributeInfo[] {
        return this.allAttributes.privateAttributes;
    }

    get properties(): ClassMember[] {
        if (this._properties) {
            return this._properties;
        }
        this._properties = getProperties(this.metadata);
        return this._properties;
    }

    get methods(): ClassMember[] {
        if (this._methods) {
            return this._methods;
        }
        this._methods = getMethods(this.metadata);
        return this._methods;
    }

    get apiMethods(): ClassMember[] {
        return this.methods.filter((method) => method.decorator === 'api');
    }

    get range(): Range {
        if (this.metadata.declarationLoc) {
            return toVSCodeRange(this.metadata.declarationLoc);
        } else {
            return Range.create(Position.create(0, 0), Position.create(0, 0));
        }
    }

    get location(): Location {
        return Location.create(this.uri, this.range);
    }

    get allLocations(): Location[] {
        const { dir, name } = path.parse(this.file);

        const convertFileToLocation = (file: string): Location => {
            const uri = URI.file(path.resolve(file)).toString();
            const position = Position.create(0, 0);
            const range = Range.create(position, position);
            return Location.create(uri, range);
        };

        const filteredFiles = glob.sync(`${dir}/${name}.+(html|css)`);
        const locations = filteredFiles.map(convertFileToLocation);
        locations.unshift(this.location);

        return locations;
    }

    updateMetadata(meta: any): void {
        this.metadata = meta;
        this._allAttributes = null;
        this._methods = null;
        this._properties = null;
        const data = fs.statSync(this.file);
        this.updatedAt = data.mtime;
    }

    static async fromFile(file: string, updatedAt?: Date): Promise<Tag> | null {
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
        return new Tag({ file, metadata, updatedAt });
    }
}
