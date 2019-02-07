import { WorkspaceContext, shared, Indexer, TagInfo } from 'lightning-lsp-common';
import { parseMarkup, loadStandardComponents, loadSystemTags, resetIndexes, tagEvents } from '../markup/auraTags';
import { LWCIndexer } from 'lwc-language-server/lib/indexer';
import { IConnection, NotificationType } from 'vscode-languageserver';

const { WorkspaceType } = shared;

interface ITagParams {
    taginfo: TagInfo;
}

const tagAdded: NotificationType<ITagParams, void> = new NotificationType<ITagParams, void>('salesforce/tagAdded');
const tagDeleted: NotificationType<string, void> = new NotificationType<string, void>('salesforce/tagDeleted');
const tagsCleared: NotificationType<void, void> = new NotificationType<void, void>('salesforce/tagsCleared');

export default class AuraIndexer implements Indexer {
    private context: WorkspaceContext;
    private connection?: IConnection;

    constructor(context: WorkspaceContext, connection?: IConnection) {
        this.context = context;
        this.connection = connection;
        this.context.addIndexingProvider({ name: 'aura', indexer: this });
    }

    public async configureAndIndex() {
        if (this.connection) {
            tagEvents.on('set', (tag: TagInfo) => {
                this.connection.sendNotification(tagAdded, { taginfo: tag });
            });
            tagEvents.on('delete', (tag: string) => {
                this.connection.sendNotification(tagDeleted, tag);
            });
            tagEvents.on('clear', () => {
                this.connection.sendNotification(tagsCleared, undefined);
            });
        }

        const lwcIndexer = new LWCIndexer(this.context);
        // // wait for indexing to finish before returning from onInitialize()
        await lwcIndexer.configureAndIndex();
        this.context.addIndexingProvider({ name: 'lwc', indexer: lwcIndexer });

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

    public resetIndex() {
        this.context.getIndexingProvider('lwc').resetIndex();
        resetIndexes();
    }
}
