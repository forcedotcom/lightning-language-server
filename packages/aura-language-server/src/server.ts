import * as path from 'path';

import {
    createConnection,
    IConnection,
    TextDocuments,
    InitializeParams,
    InitializeResult,
    TextDocumentPositionParams,
    CompletionList,
    CompletionItem,
    DidChangeWatchedFilesParams,
    Hover,
    Location,
    ShowMessageNotification,
    MessageType,
    TextDocumentChangeEvent,
    CompletionParams,
    Position,
    Range,
    ReferenceParams,
    SignatureHelp,
    SignatureInformation,
    ParameterInformation,
    FileChangeType,
    NotificationType,
    Definition,
} from 'vscode-languageserver';

import * as auraUtils from './aura-utils';
import URI from 'vscode-uri';
import { getLanguageService, LanguageService } from 'lightning-lsp-common';
import { startServer, addFile, delFile, onCompletion, onHover, onDefinition, onTypeDefinition, onReferences, onSignatureHelp } from './tern-server/tern-server';
import { WorkspaceContext, utils, interceptConsoleLogger, TagInfo } from 'lightning-lsp-common';
import { LWCIndexer } from 'lwc-language-server';
import AuraIndexer from './aura-indexer/indexer';
import { toResolvedPath } from 'lightning-lsp-common/lib/utils';
import { setIndexer, getAuraTagProvider } from './markup/auraTags';
import { WorkspaceType } from 'lightning-lsp-common/lib/shared';

interface ITagParams {
    taginfo: TagInfo;
}

const tagAdded: NotificationType<ITagParams, void> = new NotificationType<ITagParams, void>('salesforce/tagAdded');
const tagDeleted: NotificationType<string, void> = new NotificationType<string, void>('salesforce/tagDeleted');
const tagsCleared: NotificationType<void, void> = new NotificationType<void, void>('salesforce/tagsCleared');

// Create a standard connection and let the caller decide the strategy
// Available strategies: '--node-ipc', '--stdio' or '--socket={number}'
const connection: IConnection = createConnection();
interceptConsoleLogger(connection);

// Create a document namager supporting only full document sync
const documents: TextDocuments = new TextDocuments();
documents.listen(connection);

let htmlLS: LanguageService;
let context: WorkspaceContext;

function startIndexing() {
    setTimeout(async () => {
        const indexer = context.getIndexingProvider('aura') as AuraIndexer;
        connection.sendNotification('salesforce/indexingStarted');
        await indexer.configureAndIndex();
        connection.sendNotification('salesforce/indexingEnded');
    }, 0);
}

connection.onInitialize(
    async (params: InitializeParams): Promise<InitializeResult> => {
        const { rootUri, rootPath, capabilities } = params;

        const workspaceRoot = path.resolve(rootUri ? URI.parse(rootUri).fsPath : rootPath);
        try {
            if (!workspaceRoot) {
                console.warn(`No workspace found`);
                return { capabilities: {} };
            }

            console.info(`Starting *AURA* language server at ${workspaceRoot}`);
            const startTime = process.hrtime();
            await startServer(rootPath, workspaceRoot);

            context = new WorkspaceContext(workspaceRoot);
            context.configureProject();

            const auraIndexer = new AuraIndexer(context);
            setIndexer(auraIndexer);

            auraIndexer.eventEmitter.on('set', (tag: TagInfo) => {
                connection.sendNotification(tagAdded, { taginfo: tag });
            });
            auraIndexer.eventEmitter.on('delete', (tag: string) => {
                connection.sendNotification(tagDeleted, tag);
            });
            auraIndexer.eventEmitter.on('clear', () => {
                connection.sendNotification(tagsCleared, undefined);
            });

            startIndexing();

            htmlLS = getLanguageService();
            htmlLS.addTagProvider(getAuraTagProvider());
            console.info('... language server started in ' + utils.elapsedMillis(startTime));

            documents.onDidOpen(addFile);
            documents.onDidChangeContent(addFile);
            documents.onDidClose(delFile);
            connection.onReferences(onReferences);
            connection.onSignatureHelp(onSignatureHelp);

            return {
                capabilities: {
                    textDocumentSync: documents.syncKind,
                    completionProvider: {
                        resolveProvider: true,
                    },
                    signatureHelpProvider: {
                        triggerCharacters: ['('],
                    },
                    referencesProvider: true,
                    hoverProvider: true,
                    definitionProvider: true,
                    typeDefinitionProvider: true,
                },
            };
        } catch (e) {
            throw new Error(`Aura Language Server initialization unsuccessful. Error message: ${e.message}`);
        }
    },
);

// Make sure to clear all the diagnostics when a document gets closed
documents.onDidClose(event => {
    connection.sendDiagnostics({ uri: event.document.uri, diagnostics: [] });
});

connection.onCompletion(
    async (completionParams: CompletionParams): Promise<CompletionList> => {
        const document = documents.get(completionParams.textDocument.uri);
        if (await context.isAuraMarkup(document)) {
            const htmlDocument = htmlLS.parseHTMLDocument(document);

            const list: CompletionList = htmlLS.doComplete(document, completionParams.position, htmlDocument, {
                isSfdxProject: context.type === WorkspaceType.SFDX,
                useAttributeValueQuotes: true,
            });
            return list;
        }
        if (await context.isAuraJavascript(document)) {
            return onCompletion(completionParams);
        }
        return { isIncomplete: false, items: [] };
    },
);

connection.onCompletionResolve(
    (item: CompletionItem): CompletionItem => {
        return item;
    },
);

connection.onHover(
    async (textDocumentPosition: TextDocumentPositionParams): Promise<Hover> => {
        const document = documents.get(textDocumentPosition.textDocument.uri);
        if (await context.isAuraMarkup(document)) {
            const htmlDocument = htmlLS.parseHTMLDocument(document);
            const hover = htmlLS.doHover(document, textDocumentPosition.position, htmlDocument);
            return hover;
        }
        if (await context.isAuraJavascript(document)) {
            return onHover(textDocumentPosition);
        }
        return null;
    },
);
connection.onTypeDefinition(
    async (textDocumentPosition: TextDocumentPositionParams): Promise<Definition> => {
        const document = documents.get(textDocumentPosition.textDocument.uri);
        if (await context.isAuraJavascript(document)) {
            return onTypeDefinition(textDocumentPosition);
        }
        return null;
    },
);

function findJavascriptProperty(valueProperty: string, textDocumentPosition: TextDocumentPositionParams): Location | null {
    // couldn't find it within the markup file, try looking for it as a javascript property
    const fsPath = URI.parse(textDocumentPosition.textDocument.uri).fsPath;
    const parsedPath = path.parse(fsPath);
    const componentName = parsedPath.name;
    const namespace = path.basename(path.dirname(parsedPath.dir));
    const indexer = context.getIndexingProvider('aura') as AuraIndexer;
    const tag = indexer.getAuraByTag(namespace + ':' + componentName);
    if (tag) {
        // aura tag doesn't contain controller methods yet
        // but, if its not a v.value, its probably fine to just open the controller file
        const controllerPath = path.join(parsedPath.dir, componentName + 'Controller.js');
        return {
            uri: URI.file(controllerPath).toString(),
            range: {
                start: {
                    character: 0,
                    line: 1,
                },
                end: {
                    character: 0,
                    line: 1,
                },
            },
        };
    }
    return null;
}

connection.onDefinition(
    async (textDocumentPosition: TextDocumentPositionParams): Promise<Location> => {
        const document = documents.get(textDocumentPosition.textDocument.uri);
        if (await context.isAuraMarkup(document)) {
            const htmlDocument = htmlLS.parseHTMLDocument(document);

            let def = htmlLS.findDefinition(document, textDocumentPosition.position, htmlDocument);
            if (!def) {
                def = htmlLS.getAuraBindingTemplateDeclaration(document, textDocumentPosition.position, htmlDocument);
                if (!def) {
                    const valueProperty = htmlLS.getAuraBindingValue(document, textDocumentPosition.position, htmlDocument);
                    if (valueProperty) {
                        def = findJavascriptProperty(valueProperty, textDocumentPosition);
                    }
                }
            }
            return def;
        }
        if (await context.isAuraJavascript(document)) {
            return onDefinition(textDocumentPosition);
        }
        return null;
    },
);

connection.onDidChangeWatchedFiles(async (change: DidChangeWatchedFilesParams) => {
    console.info('aura onDidChangeWatchedFiles...');
    const changes = change.changes;

    try {
        const lwcIndexer = context.getIndexingProvider('lwc') as LWCIndexer;
        lwcIndexer.handleWatchedFiles(context, change);
        if (utils.isAuraRootDirectoryCreated(context, changes)) {
            await context.getIndexingProvider('aura').resetIndex();
            await context.getIndexingProvider('aura').configureAndIndex();
            // re-index everything on directory deletions as no events are reported for contents of deleted directories
            const startTime = process.hrtime();
            console.info('reindexed workspace in ' + utils.elapsedMillis(startTime) + ', directory was deleted:', changes);
            return;
        } else {
            let files = 0;
            for (const event of changes) {
                if (event.type === FileChangeType.Deleted && utils.isAuraWatchedDirectory(context, event.uri)) {
                    const dir = toResolvedPath(event.uri);
                    const indexer = context.getIndexingProvider('aura') as AuraIndexer;
                    indexer.clearTagsforDirectory(dir, context.type === WorkspaceType.SFDX);
                    files++;
                } else {
                    const file = toResolvedPath(event.uri);
                    if (/.*(.app|.cmp|.intf|.evt|.lib)$/.test(file)) {
                        const indexer = context.getIndexingProvider('aura') as AuraIndexer;
                        await indexer.indexFile(file, context.type === WorkspaceType.SFDX);
                        files++;
                    }
                }
            }
        }
    } catch (e) {
        connection.sendNotification(ShowMessageNotification.type, { type: MessageType.Error, message: `Error re-indexing workspace: ${e.message}` });
    }
});

connection.onRequest('salesforce/listComponents', () => {
    const indexer = context.getIndexingProvider('aura') as AuraIndexer;
    const tags = indexer.getAuraTags();
    const result = JSON.stringify([...tags]);
    return result;
});

connection.onRequest('salesforce/listNamespaces', () => {
    const indexer = context.getIndexingProvider('aura') as AuraIndexer;
    const tags = indexer.getAuraNamespaces();
    const result = JSON.stringify(tags);
    return result;
});

// connection.onRequest((method: string, ...params: any[]) => {
//     // debugger
// });

// Listen on the connection
connection.listen();
