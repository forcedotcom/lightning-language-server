import { IAttributeData, ITagData, IValueData, IHTMLDataProvider } from 'vscode-html-languageservice';
import ComponentIndexer from './component-indexer';
import * as fs from 'fs-extra';
import { join } from 'path';

type DataProviderAttributes = {
    indexer: ComponentIndexer;
};

export class LWCDataProvider implements IHTMLDataProvider {
    activated: boolean = false;
    indexer?: ComponentIndexer;
    private readonly _standardTags: ITagData[];
    private readonly _globalAttributes: IAttributeData[];

    constructor(attributes?: DataProviderAttributes) {
        this.indexer = attributes.indexer;
        const standardData = fs.readFileSync(join(__dirname, 'resources/standard-lwc.json'), 'utf-8');
        const standardJson = JSON.parse(standardData);
        this._standardTags = standardJson.tags;
        this._globalAttributes = standardJson.globalAttributes;
    }

    getId(): string {
        return 'lwc';
    }

    isApplicable(): boolean {
        return this.activated;
    }
    provideTags(): ITagData[] {
        return [...this._standardTags, ...this.indexer.customData];
    }
    provideAttributes(tagName: string): IAttributeData[] {
        const tag = this.provideTags().find(t => t.name === tagName);
        return [...this._globalAttributes, ...(tag?.attributes || [])];
    }
    provideValues(): IValueData[] {
        return [];
    }
}
