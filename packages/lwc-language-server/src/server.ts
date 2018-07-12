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
} from 'vscode-languageserver';

import { WorkspaceContext } from './context';

import templateLinter from './template/linter';
import { compileDocument as javascriptCompileDocument } from './javascript/compiler';
import * as utils from './utils';
import { updateLabelsIndex } from './metadata-utils/custom-labels-util';
import { updateStaticResourceIndex } from './metadata-utils/static-resources-util';
import { updateCustomComponentIndex, addCustomTagFromResults } from './metadata-utils/custom-components-util';
import { getLanguageService, LanguageService } from './html-language-service/htmlLanguageService';
import URI from 'vscode-uri';

import { WorkspaceType } from './shared';
export * from './shared';

// Create a standard connection and let the caller decide the strategy
// Available strategies: '--node-ipc', '--stdio' or '--socket={number}'
const connection: IConnection = createConnection();

// Create a document namager supporting only full document sync
const documents: TextDocuments = new TextDocuments();
documents.listen(connection);

let htmlLS: LanguageService;
let context: WorkspaceContext;

connection.onInitialize(
    async (params: InitializeParams): Promise<InitializeResult> => {
        const { rootUri, rootPath } = params;

        // Early exit if no workspace is opened
        const workspaceRoot = path.resolve(rootUri ? URI.parse(rootUri).fsPath : rootPath);
        try {
            if (!workspaceRoot) {
                console.warn(`No workspace found`);
                return { capabilities: {} };
            }

            console.info(`Starting language server at ${workspaceRoot}`);
            const startTime = process.hrtime();
            context = new WorkspaceContext(workspaceRoot);
            // wait for indexing to finish before returning from onInitialize()
            await context.configureAndIndex();
            htmlLS = getLanguageService();
            console.info('     ... language server started in ' + utils.elapsedMillis(startTime), context);
            // Return the language server capabilities
            return {
                capabilities: {
                    textDocumentSync: documents.syncKind,
                    completionProvider: {
                        resolveProvider: true,
                    },
                    hoverProvider: true,
                    definitionProvider: true,
                },
            };
        } catch (e) {
            throw new Error(`LWC Language Server initialization unsuccessful. Error message: ${e.message}`);
        }
    },
);

// Make sure to clear all the diagnostics when a document gets closed
documents.onDidClose(event => {
    connection.sendDiagnostics({ uri: event.document.uri, diagnostics: [] });
});

documents.onDidChangeContent(async change => {
    // TODO: when hovering on an html tag, this is called for the target .js document (bug in vscode?)
    const { document } = change;
    const { uri } = document;
    if (context.isLWCTemplate(document)) {
        const diagnostics = templateLinter(document);
        connection.sendDiagnostics({ uri, diagnostics });
    } else if (context.isLWCJavascript(document)) {
        const { result, diagnostics } = await javascriptCompileDocument(document);
        connection.sendDiagnostics({ uri, diagnostics });
        if (result) {
            addCustomTagFromResults(uri, result.metadata, context.type === WorkspaceType.SFDX);
        }
    }
});

connection.onCompletion(
    (textDocumentPosition: TextDocumentPositionParams): CompletionList => {
        const document = documents.get(textDocumentPosition.textDocument.uri);
        if (!context.isLWCTemplate(document)) {
            return { isIncomplete: false, items: [] };
        }
        const htmlDocument = htmlLS.parseHTMLDocument(document);
        return htmlLS.doComplete(document, textDocumentPosition.position, htmlDocument, context.type === WorkspaceType.SFDX);
    },
);

connection.onCompletionResolve(
    (item: CompletionItem): CompletionItem => {
        return item;
    },
);

connection.onHover(
    (textDocumentPosition: TextDocumentPositionParams): Hover => {
        const document = documents.get(textDocumentPosition.textDocument.uri);
        if (!context.isLWCTemplate(document)) {
            return null;
        }
        const htmlDocument = htmlLS.parseHTMLDocument(document);
        return htmlLS.doHover(document, textDocumentPosition.position, htmlDocument);
    },
);

connection.onDefinition(
    (textDocumentPosition: TextDocumentPositionParams): Location => {
        const document = documents.get(textDocumentPosition.textDocument.uri);
        if (!context.isLWCTemplate(document)) {
            return null;
        }
        const htmlDocument = htmlLS.parseHTMLDocument(document);
        return htmlLS.findDefinition(document, textDocumentPosition.position, htmlDocument);
    },
);

// Listen on the connection
connection.listen();

connection.onDidChangeWatchedFiles(async (change: DidChangeWatchedFilesParams) => {
    console.info('onDidChangeWatchedFiles...');
    const changes = change.changes;
    try {
        if (utils.includesWatchedDirectory(changes)) {
            // re-index everything on directory deletions as no events are reported for contents of deleted directories
            const startTime = process.hrtime();
            await context.configureAndIndex();
            console.info('reindexed workspace in ' + utils.elapsedMillis(startTime) + ', directory was deleted:', changes);
        } else {
            await Promise.all([updateStaticResourceIndex(changes, context), updateLabelsIndex(changes, context), updateCustomComponentIndex(changes, context)]);
        }
    } catch (e) {
        connection.sendNotification(ShowMessageNotification.type, { type: MessageType.Error, message: `Error re-indexing workspace: ${e.message}` });
    }
});
