import { IAttributeData, ITagData, IValueData, IHTMLDataProvider } from 'vscode-html-languageservice';
import { getLwcTags } from './metadata-utils/custom-components-util';
import ComponentIndexer from './component-indexer';

type DataProviderAttributes = {
    indexer: ComponentIndexer;
};

export class LWCDataProvider implements IHTMLDataProvider {
    indexer?: ComponentIndexer;

    constructor(attributes?: DataProviderAttributes) {
        this.indexer = attributes.indexer;
    }

    getId(): string {
        return 'lwc';
    }

    isApplicable(): boolean {
        return true;
    }
    provideTags(): ITagData[] {
        return this.indexer.customData;
    }
    provideAttributes(tag: string): IAttributeData[] {
        return this.indexer.tags.get(tag)?.attributes || [];
    }
    provideValues(tag: string, attribute: string): IValueData[] {
        return [];
    }
}
