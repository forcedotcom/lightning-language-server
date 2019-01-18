import { indexCustomComponents, loadStandardComponents, resetCustomComponents } from './metadata-utils/custom-components-util';
import { indexCustomLabels, resetCustomLabels } from './metadata-utils/custom-labels-util';
import { indexStaticResources, resetStaticResources } from './metadata-utils/static-resources-util';
import { indexContentAssets, resetContentAssets } from './metadata-utils/content-assets-util';
import { WorkspaceContext, shared, Indexer } from 'lightning-lsp-common';

const { WorkspaceType } = shared;

export default class LWCIndexer implements Indexer {
    private context: WorkspaceContext;

    constructor(context: WorkspaceContext) {
        this.context = context;
    }
    public async configureAndIndex() {
        this.resetAllIndexes();

        // indexing:
        const indexingTasks: Array<Promise<void>> = [];
        if (this.context.type !== WorkspaceType.STANDARD_LWC) {
            indexingTasks.push(loadStandardComponents());
        }
        indexingTasks.push(indexCustomComponents(this.context));
        if (this.context.type === WorkspaceType.SFDX) {
            indexingTasks.push(indexStaticResources(this.context.workspaceRoot, this.context.sfdxPackageDirsPattern));
            indexingTasks.push(indexContentAssets(this.context.workspaceRoot, this.context.sfdxPackageDirsPattern));
            indexingTasks.push(indexCustomLabels(this.context.workspaceRoot, this.context.sfdxPackageDirsPattern));
        }
        await Promise.all(indexingTasks);
    }
    private resetAllIndexes() {
        resetCustomComponents();
        resetCustomLabels();
        resetStaticResources();
        resetContentAssets();
    }
}
