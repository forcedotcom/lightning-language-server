import { indexCustomComponents, loadStandardComponents, resetCustomComponents } from './metadata-utils/custom-components-util';
import { indexCustomLabels, resetCustomLabels } from './metadata-utils/custom-labels-util';
import { indexStaticResources, resetStaticResources } from './metadata-utils/static-resources-util';
import { indexContentAssets, resetContentAssets } from './metadata-utils/content-assets-util';
import { WorkspaceContext, shared, Indexer } from 'lightning-lsp-common';
import { getLanguageService, LanguageService } from 'lightning-lsp-common';
import { getLwcTags } from './metadata-utils/custom-components-util';

import { updateLabelsIndex } from './metadata-utils/custom-labels-util';
import { updateStaticResourceIndex } from './metadata-utils/static-resources-util';
import { updateContentAssetIndex } from './metadata-utils/content-assets-util';
import { updateCustomComponentIndex, tagEvents } from './metadata-utils/custom-components-util';
import { utils } from 'lightning-lsp-common';
import { DidChangeWatchedFilesParams } from 'vscode-languageserver';

const { WorkspaceType } = shared;

export class LWCIndexer implements Indexer {
    private context: WorkspaceContext;
    private writeConfigs: boolean;
    private indexingTasks: Promise<void>;

    constructor(context: WorkspaceContext, writeConfigs: boolean = true) {
        this.context = context;
        this.writeConfigs = writeConfigs;
    }

    public async configureAndIndex() {
        // indexing:
        const indexingTasks: Array<Promise<void>> = [];
        if (this.context.type !== WorkspaceType.STANDARD_LWC) {
            indexingTasks.push(loadStandardComponents(this.context, this.writeConfigs));
        }
        indexingTasks.push(indexCustomComponents(this.context, this.writeConfigs));
        if (this.context.type === WorkspaceType.SFDX) {
            indexingTasks.push(indexStaticResources(this.context, this.writeConfigs));
            indexingTasks.push(indexContentAssets(this.context, this.writeConfigs));
            indexingTasks.push(indexCustomLabels(this.context, this.writeConfigs));
        }
        this.indexingTasks = Promise.all(indexingTasks).then(() => undefined);
        return this.indexingTasks;
    }

    public async waitOnIndex() {
        return this.indexingTasks;
    }

    public resetIndex() {
        resetCustomComponents();
        resetCustomLabels();
        resetStaticResources();
        resetContentAssets();
    }
}

export async function handleWatchedFiles(workspaceContext: WorkspaceContext, change: DidChangeWatchedFilesParams): Promise<void> {
    const changes = change.changes;

    if (utils.isLWCRootDirectoryCreated(workspaceContext, changes)) {
        const startTime = process.hrtime();
        await workspaceContext.getIndexingProvider('lwc').configureAndIndex();
        console.info('reindexed workspace in ' + utils.elapsedMillis(startTime), changes);
    } else {
        await Promise.all([
            updateStaticResourceIndex(changes, workspaceContext, this.writeConfigs),
            updateContentAssetIndex(changes, workspaceContext, this.writeConfigs),
            updateLabelsIndex(changes, workspaceContext, this.writeConfigs),
            updateCustomComponentIndex(changes, workspaceContext, this.writeConfigs),
        ]);
    }
}

export { getLanguageService, LanguageService, getLwcTags, tagEvents };
