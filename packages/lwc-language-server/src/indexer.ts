import {
    indexCustomComponents,
    loadStandardComponents,
    resetCustomComponents,
    getLwcTags,
    updateCustomComponentIndex,
    eventEmitter,
    persistCustomComponents,
} from './metadata-utils/custom-components-util';
import { indexCustomLabels, resetCustomLabels, updateLabelsIndex, persistCustomLabels } from './metadata-utils/custom-labels-util';
import { indexStaticResources, resetStaticResources, updateStaticResourceIndex, persistStaticResources } from './metadata-utils/static-resources-util';
import { indexContentAssets, resetContentAssets, updateContentAssetIndex, persistContentAssets } from './metadata-utils/content-assets-util';
import { indexMessageChannels, resetMessageChannels, updateMessageChannelsIndex, persistMessageChannels } from './metadata-utils/message-channel-util';
import { WorkspaceContext, shared, Indexer, getLanguageService, LanguageService, utils } from '@salesforce/lightning-lsp-common';
import { DidChangeWatchedFilesParams } from 'vscode-languageserver';
import { EventEmitter } from 'events';
import { join } from 'path';
import { mkdirSync } from 'fs';

const { WorkspaceType } = shared;
const INDEX_DIR = '.sfdx/indexes/lwc';

export class LWCIndexer implements Indexer {
    public readonly eventEmitter = new EventEmitter();

    private context: WorkspaceContext;
    private writeConfigs: boolean;
    private indexingTasks: Promise<void>;

    constructor(context: WorkspaceContext, writeConfigs: boolean = true) {
        this.context = context;
        this.writeConfigs = writeConfigs;
        this.eventEmitter = eventEmitter;
    }

    public async configureAndIndex() {
        const indexingTasks: Promise<void>[] = [];
        if (this.context.type !== WorkspaceType.STANDARD_LWC) {
            // indexingTasks.push(loadStandardComponents(this.context, this.writeConfigs));
        }
        indexingTasks.push(indexCustomComponents(this.context, this.writeConfigs));
        if (this.context.type === WorkspaceType.SFDX) {
            indexingTasks.push(indexStaticResources(this.context, this.writeConfigs));
            indexingTasks.push(indexContentAssets(this.context, this.writeConfigs));
            indexingTasks.push(indexCustomLabels(this.context, this.writeConfigs));
            indexingTasks.push(indexMessageChannels(this.context, this.writeConfigs));
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
        resetMessageChannels();
    }

    public persistIndex() {
        this.ensureIndexDirectory(this.context);
        persistCustomComponents(this.context);
        persistStaticResources(this.context);
        persistContentAssets(this.context);
        persistCustomLabels(this.context);
        persistMessageChannels(this.context);
    }

    public async handleWatchedFiles(workspaceContext: WorkspaceContext, change: DidChangeWatchedFilesParams): Promise<void> {
        const changes = change.changes;

        if (utils.isLWCRootDirectoryCreated(workspaceContext, changes)) {
            const startTime = process.hrtime();
            workspaceContext.getIndexingProvider('lwc').resetIndex();
            await workspaceContext.getIndexingProvider('lwc').configureAndIndex();
            console.info('reindexed workspace in ' + utils.elapsedMillis(startTime), changes);
        } else {
            await Promise.all([
                updateStaticResourceIndex(changes, workspaceContext, this.writeConfigs),
                updateContentAssetIndex(changes, workspaceContext, this.writeConfigs),
                updateLabelsIndex(changes, workspaceContext, this.writeConfigs),
                updateCustomComponentIndex(changes, workspaceContext, this.writeConfigs),
                updateMessageChannelsIndex(changes, workspaceContext, this.writeConfigs),
            ]);
        }
    }

    private ensureIndexDirectory(context: WorkspaceContext): void {
        const { workspaceRoots } = context;
        const indexDirPath = join(workspaceRoots[0], INDEX_DIR);
        mkdirSync(indexDirPath, { recursive: true });
    }
}

export { getLanguageService, LanguageService, getLwcTags, eventEmitter };
