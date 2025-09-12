import { IAttributeData, ITagData, IValueData, IHTMLDataProvider } from 'vscode-html-languageservice';
import ComponentIndexer from './component-indexer';

type DataProviderAttributes = {
    indexer: ComponentIndexer;
};

export class AuraDataProvider implements IHTMLDataProvider {
    indexer?: ComponentIndexer;
    activated = false;

    constructor(attributes?: DataProviderAttributes) {
        this.indexer = attributes.indexer;
    }

    getId(): string {
        return 'lwc-aura';
    }

    isApplicable(): boolean {
        return this.activated;
    }
    provideTags(): ITagData[] {
        return this.indexer.customData.map((tag) => ({
            name: tag.auraName,
            description: tag.description,
            attributes: tag.attributes,
        }));
    }
    provideAttributes(tagName: string): IAttributeData[] {
        const tags = this.provideTags();
        const tag = tags.find((t) => t.name.toLowerCase() === tagName);
        return tag?.attributes || [];
    }
    provideValues(): IValueData[] {
        return [];
    }
}
