import {
    indexCustomComponents,
    loadStandardComponents,
    resetCustomComponents,
    getLwcTags,
    updateCustomComponentIndex,
    eventEmitter,
} from './metadata-utils/custom-components-util';
import { indexCustomLabels, resetCustomLabels, updateLabelsIndex } from './metadata-utils/custom-labels-util';
import { indexStaticResources, resetStaticResources, updateStaticResourceIndex, persistStaticResources } from './metadata-utils/static-resources-util';
import { indexContentAssets, resetContentAssets, updateContentAssetIndex } from './metadata-utils/content-assets-util';
import { indexMessageChannels, resetMessageChannels, updateMessageChannelsIndex, persistMessageChannels } from './metadata-utils/message-channel-util';
import { WorkspaceContext, shared, Indexer, getLanguageService, LanguageService, utils } from '@salesforce/lightning-lsp-common';
import { DidChangeWatchedFilesParams } from 'vscode-languageserver';
import { EventEmitter } from 'events';

const { WorkspaceType } = shared;

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
        const tasks: Promise<void>[] = [indexCustomComponents(this.context, this.writeConfigs)];

        if (this.context.type !== WorkspaceType.STANDARD_LWC) {
            tasks.push(loadStandardComponents(this.context, this.writeConfigs));
        }

        if (this.context.type === WorkspaceType.SFDX) {
            tasks.push(
                ...[
                    indexStaticResources(this.context, this.writeConfigs),
                    indexContentAssets(this.context, this.writeConfigs),
                    indexCustomLabels(this.context, this.writeConfigs),
                    indexMessageChannels(this.context, this.writeConfigs),
                ],
            );
        }

        this.indexingTasks = Promise.all(tasks).then(() => undefined);
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
        persistStaticResources(this.context);
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
}

export { getLanguageService, LanguageService, getLwcTags, eventEmitter };
