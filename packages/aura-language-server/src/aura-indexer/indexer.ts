import { WorkspaceContext, shared, Indexer } from 'lightning-lsp-common';
import { parseMarkup, loadStandardComponents, loadSystemTags, resetIndexes } from '../markup/auraTags';

const { WorkspaceType } = shared;

export default class AuraIndexer implements Indexer {
    private context: WorkspaceContext;

    constructor(context: WorkspaceContext) {
        this.context = context;
    }
    public async configureAndIndex() {
        this.resetAllIndexes();
        await loadStandardComponents();
        await loadSystemTags();
        const markupfiles = this.context.findAllAuraMarkup();
        for (const file of markupfiles) {
            try {
                await parseMarkup(file, this.context.type === WorkspaceType.SFDX);
            } catch (e) {
                console.log(`Error parsing markup from ${file}: + ${e}`);
            }
        }
    }

    private resetAllIndexes() {
        resetIndexes();
    }
}
