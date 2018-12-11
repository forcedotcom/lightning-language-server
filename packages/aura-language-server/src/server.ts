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
} from 'vscode-languageserver';

import * as utils from './utils';
import URI from 'vscode-uri';

import { WorkspaceType } from './shared';
export * from './shared';
import { startServer } from './tern-server';
import * as util from 'util';
import * as tern from 'tern';

// Create a standard connection and let the caller decide the strategy
// Available strategies: '--node-ipc', '--stdio' or '--socket={number}'
const connection: IConnection = createConnection();

// Create a document namager supporting only full document sync
const documents: TextDocuments = new TextDocuments();
documents.listen(connection);

let ternServer;
let asyncTernRequest;

function lsp2ternPos({ line, character }: { line: number; character: number }): tern.Position {
    return { line, ch: character };
}

function uriToFile(uri: string): string {
    return URI.parse(uri).fsPath;
}

function fileToUri(file: string): string {
    return URI.file(file).toString();
}

async function ternRequest(event: TextDocumentPositionParams, type: string, options: any = {}) {
    return await asyncTernRequest({
        query: {
            type,
            file: uriToFile(event.textDocument.uri),
            end: lsp2ternPos(event.position),
            lineCharPositions: true,
            ...options,
        },
    });
}

connection.onInitialize(
    async (params: InitializeParams): Promise<InitializeResult> => {
        const { rootUri, rootPath } = params;
        console.log('starting server');
        ternServer = await startServer(rootPath);
        asyncTernRequest = util.promisify(ternServer.request.bind(ternServer));
        // Early exit if no workspace is opened
        const workspaceRoot = path.resolve(rootUri ? URI.parse(rootUri).fsPath : rootPath);
        try {
            if (!workspaceRoot) {
                console.warn(`No workspace found`);
                return { capabilities: {} };
            }

            console.info(`Starting language server at ${workspaceRoot}`);
            const startTime = process.hrtime();

            // context = new WorkspaceContext(workspaceRoot);
            // wait for indexing to finish before returning from onInitialize()
            // await context.configureAndIndex();
            // htmlLS = getLanguageService();
            console.info('     ... language server started in ' + utils.elapsedMillis(startTime));
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

const refresh = (event: TextDocumentChangeEvent) => {
    const document = event.document;
    ternServer.addFile(uriToFile(document.uri), document.getText());
};

documents.onDidOpen(async (open: TextDocumentChangeEvent) => {
     refresh(open);
});

documents.onDidChangeContent(async (change: TextDocumentChangeEvent) => {
     refresh(change);
});

connection.onCompletion(
    async (completionParams: CompletionParams): Promise<CompletionList> => {

        const { completions } = await ternRequest(completionParams, 'completions', {
            types: true,
            docs: true,
            caseInsensitive: true,
        });
        return completions.map(completion => ({
            documentation: completion.doc,
            detail: completion.type,
            label: completion.name,
        }));

        //const document = documents.get(textDocumentPosition.textDocument.uri);
        // if (!context.isLWCTemplate(do            cument)) {
        //     return { isIncomplete: false, items: [] };
        // }
        // const htmlDocument = htmlLS.parseHTMLDocument(document);
        // return htmlLS.doComplete(document, textDocumentPosition.position, htmlDocument, context.type === WorkspaceType.SFDX);
        // return;
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
        // if (!context.isLWCTemplate(document)) {
        //     return null;
        // }
        // const htmlDocument = htmlLS.parseHTMLDocument(document);
        // return htmlLS.doHover(document, textDocumentPosition.position, htmlDocument);
        return;
    },
);

connection.onDefinition(
    (textDocumentPosition: TextDocumentPositionParams): Location => {
        const document = documents.get(textDocumentPosition.textDocument.uri);
        // if (!context.isLWCTemplate(document)) {
        //     return null;
        // }
        // const htmlDocument = htmlLS.parseHTMLDocument(document);
        // return htmlLS.findDefinition(document, textDocumentPosition.position, htmlDocument);
        return;
    },
);

// Listen on the connection
connection.listen();

connection.onDidChangeWatchedFiles(async (change: DidChangeWatchedFilesParams) => {
    console.info('onDidChangeWatchedFiles...');
    const changes = change.changes;
    // try {
    //     if (utils.includesWatchedDirectory(changes)) {
    //         // re-index everything on directory deletions as no events are reported for contents of deleted directories
    //         const startTime = process.hrtime();
    //         await context.configureAndIndex();
    //         console.info('reindexed workspace in ' + utils.elapsedMillis(startTime) + ', directory was deleted:', changes);
    //     } else {
    //         // await Promise.all([updateStaticResourceIndex(changes, context), updateLabelsIndex(changes, context), updateCustomComponentIndex(changes, context)]);
    //     }
    // } catch (e) {
    //     connection.sendNotification(ShowMessageNotification.type, { type: MessageType.Error, message: `Error re-indexing workspace: ${e.message}` });
    // }
});
