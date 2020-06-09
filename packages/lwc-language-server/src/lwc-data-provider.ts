import { IAttributeData, ITagData, IValueData, IHTMLDataProvider } from 'vscode-html-languageservice';
import { getLwcTags } from './metadata-utils/custom-components-util';

export class LWCDataProvider implements IHTMLDataProvider {
    getId(): string {
        return 'lwc';
    }
    isApplicable(languageId: string): boolean {
        return true;
    }
    provideTags(): ITagData[] {
        return Array.from(getLwcTags()).map(([name, data]) => ({
            name,
            description: data.getHover(),
            attributes: data.attributes,
        }));
    }
    provideAttributes(tag: string): IAttributeData[] {
        return getLwcTags().get(tag).attributes;
    }
    provideValues(tag: string, attribute: string): IValueData[] {
        return [];
    }
}
