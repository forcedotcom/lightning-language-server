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
} from 'vscode-languageserver';

import * as utils from './utils';
import URI from 'vscode-uri';
import { getLanguageService, LanguageService } from './html-language-service/htmlLanguageService';
import { WorkspaceType } from './shared';
export * from './shared';
import { startServer } from './tern-server';
import * as util from 'util';
import * as tern from 'tern';
import { interceptConsoleLogger } from './logger';
import { isNoop } from 'babel-types';

// Create a standard connection and let the caller decide the strategy
// Available strategies: '--node-ipc', '--stdio' or '--socket={number}'
const connection: IConnection = createConnection();
interceptConsoleLogger(connection);

// Create a document namager supporting only full document sync
const documents: TextDocuments = new TextDocuments();
documents.listen(connection);

let ternServer;
let asyncTernRequest;
let theRootPath;

function lsp2ternPos({ line, character }: { line: number; character: number }): tern.Position {
    return { line, ch: character };
}

function tern2lspPos({ line, ch }: { line: number; ch: number }): Position {
    return { line, character: ch };
}

function tern2lspLocation({ file, start, end }: { file: string; start: tern.Position; end: tern.Position }): Location {
    return {
        uri: fileToUri(file),
        range: tern2lspRange({ start, end }),
    };
}

function tern2lspRange({ start, end }: { start: tern.Position; end: tern.Position }): Range {
    return {
        start: tern2lspPos(start),
        end: tern2lspPos(end),
    };
}

function uriToFile(uri: string): string {
    return URI.parse(uri).fsPath;
}

function fileToUri(file: string): string {
    // internally, tern will strip the project root, so we have to add it back
    return URI.file(path.join(theRootPath, file)).toString();
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

let htmlLS: LanguageService;

connection.onInitialize(
    async (params: InitializeParams): Promise<InitializeResult> => {
        const { rootUri, rootPath } = params;
        theRootPath = rootPath;

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
            htmlLS = getLanguageService();
            console.info('     ... language server started in ' + utils.elapsedMillis(startTime));
            // Return the language server capabilities
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

const addFile = (event: TextDocumentChangeEvent) => {
    const { document } = event;
    ternServer.addFile(uriToFile(document.uri), document.getText());
};

documents.onDidOpen(async (open: TextDocumentChangeEvent) => {
    addFile(open);
});

documents.onDidChangeContent(async (change: TextDocumentChangeEvent) => {
    addFile(change);
});

documents.onDidClose((close: TextDocumentChangeEvent) => {
    const { document } = close;
    ternServer.delFile(uriToFile(document.uri));
});

connection.onCompletion(
    async (completionParams: CompletionParams): Promise<CompletionList> => {
        const { completions } = await ternRequest(completionParams, 'completions', {
            types: true,
            docs: true,
            depths: true,
            guess: true,
            origins: true,
            urls: true,
            expandWordForward: false,
            end: true,
            caseInsensitive: true,
        });
        return completions.map(completion => ({
            documentation: completion.doc,
            detail: completion.type,
            label: completion.name,
        }));
    },
);

connection.onCompletionResolve(
    (item: CompletionItem): CompletionItem => {
        return item;
    },
);

connection.onHover(
    async (textDocumentPosition: TextDocumentPositionParams): Promise<Hover> => {
        const info = await ternRequest(textDocumentPosition, 'type');

        const out = [];
        out.push(`${info.exprName || info.name}: ${info.type}`);
        if (info.doc) {
            out.push(info.doc);
        }
        if (info.url) {
            out.push(info.url);
        }

        return { contents: out };
    },
);

connection.onDefinition(
    async (textDocumentPosition: TextDocumentPositionParams): Promise<Location> => {
        const { file, start, end, origin } = await ternRequest(textDocumentPosition, 'definition', { preferFunction: false, doc: false });
        debugger;
        if (file) {
            return tern2lspLocation({ file, start, end });
        }
    },
);

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

connection.onRequest((method: string, ...params: any[]) => {
    debugger;
});

connection.onReferences(
    async (reference: ReferenceParams): Promise<Location[]> => {
        const { refs } = await ternRequest(reference, 'refs');
        if (refs && refs.length > 0) {
            return refs.map(ref => tern2lspLocation(ref));
        }
    },
);
// Listen on the connection
connection.listen();
