import { compileFile, extractAttributes, getProperties, getMethods, toVSCodeRange } from './javascript/compiler';
import { ITagData } from 'vscode-html-languageservice';
import * as fs from 'fs-extra';
import decamelize from 'decamelize';

import URI from 'vscode-uri';
import * as path from 'path';
import { Location, Position, Range } from 'vscode-languageserver';
import { Metadata, ClassMember } from '@lwc/babel-plugin-component';
import { AttributeInfo } from '@salesforce/lightning-lsp-common/lib/indexer/attributeInfo';

export default class Tag implements ITagData {
    public file: string;
    public metadata: Metadata;
    public namespace: 'lightning' | 'c' | 'interop' | null = 'c';
    public namespaceDelimiter: ':' | '-' = '-';

    private _allAttributes: { publicAttributes: AttributeInfo[]; privateAttributes: AttributeInfo[] } | null = null;
    private _properties: ClassMember[] | null = null;
    private _methods: ClassMember[] | null = null;

    constructor(attributes: { [key: string]: any }) {
        this.file = attributes.file;
        this.metadata = attributes.metadata;
        this.namespace = attributes.namespace || this.namespace;
    }

    get description(): string {
        const docs: string[] = [this.documentation, this.reference, this.attributeDocs, this.methodDocs];
        return docs.filter(item => item !== null).join('\n');
    }

    get name(): string {
        const filename = path.parse(this.file).name;
        const basename = decamelize(filename, '-');
        return `${this.namespace}${this.namespaceDelimiter}${basename}`;
    }

    get attributes(): AttributeInfo[] {
        return this.publicAttributes;
    }

    get documentation(): string {
        return this.metadata.doc;
    }

    get reference(): string | null {
        if (this.namespace !== 'lightning') return null;
        return `[View in Component Library](https://developer.salesforce.com/docs/component-library/bundle/${this.name})`;
    }

    get attributeDocs(): string | null {
        if (this.publicAttributes.length === 0) {
            return null;
        }

        return ['### Attributes', ...this.publicAttributes.map(attributeDoc)].join('\n');
    }

    get methodDocs(): string | null {
        if (this.apiMethods.length === 0) {
            return null;
        }

        return ['### Methods', ...this.apiMethods.map(methodDoc)].join('\n');
    }

    get uri() {
        return URI.file(path.resolve(this.file)).toString();
    }

    get allAttributes() {
        if (this._allAttributes) return this._allAttributes;
        this._allAttributes = extractAttributes(this.metadata, this.uri);
        return this._allAttributes;
    }

    get publicAttributes(): AttributeInfo[] {
        return this.allAttributes.publicAttributes;
    }

    get privateAttributes(): AttributeInfo[] {
        return this.allAttributes.privateAttributes;
    }

    get properties() {
        if (this._properties) return this._properties;
        this._properties = getProperties(this.metadata);
        return this._properties;
    }

    get methods() {
        if (this._methods) return this._methods;
        this._methods = getMethods(this.metadata);
        return this._methods;
    }

    get apiMethods() {
        return this.methods.filter(method => method.decorator === 'api');
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

    static async fromFile(file: string): Promise<Tag> | null {
        const { metadata, diagnostics } = await compileFile(file);
        if (diagnostics.length > 0) {
            console.log(`Could not create Tag from ${file}.\n${diagnostics}`);
            return null;
        }
        return new Tag({ file, metadata });
    }
}

function methodDoc(method: ClassMember): string {
    const { name, doc } = method;

    if (name && doc) {
        return `- **${name}()** *: ${doc}`;
    }
    if (name) {
        return `- **${name}()**`;
    }
    return '';
}

function attributeDoc(attribute: AttributeInfo): string {
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
}
