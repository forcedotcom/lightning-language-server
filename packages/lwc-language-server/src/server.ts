import {
    IPCMessageReader, IPCMessageWriter, createConnection, IConnection, TextDocuments,
    InitializeParams, InitializeResult, TextDocumentPositionParams,
    CompletionItem, SymbolInformation, DocumentSymbolParams, Files,
} from 'vscode-languageserver';

import templateLinter from './template/linter';
import templateSymbolsProvider from './template/symbols';
import templateCompletionProvider from './template/completion';

import { isTemplate } from './utils';

// Establish a new connection for the server
const connection: IConnection = createConnection(new IPCMessageReader(process), new IPCMessageWriter(process));

// Redirect the errors and warnings
console.log = connection.console.log.bind(connection.console);
console.error = connection.console.error.bind(connection.console);

// Create a document namager supporting only full document sync
const documents: TextDocuments = new TextDocuments();
documents.listen(connection);

let workspaceRoot: string;
connection.onInitialize((params: InitializeParams): InitializeResult => {
    const { rootUri, rootPath } = params;

    // Early exit if no workspace is opened
    const root = rootUri ? Files.uriToFilePath(rootUri) : rootPath;
    if (!root) {
        return { capabilities: {} };
    }

    workspaceRoot = root;
    console.log(`Starting raptor language server at ${workspaceRoot}`);

    // Return the language server capabilities
    return {
        capabilities: {
            textDocumentSync: documents.syncKind,
            documentSymbolProvider: true,
            completionProvider: {
                resolveProvider: true,
            },
        },
    };
});

// Make sure to clear all the diagnostics when the a document get closed
documents.onDidClose(event => {
    connection.sendDiagnostics({ uri: event.document.uri, diagnostics: [] });
});

documents.onDidChangeContent((change) => {
    const { document } = change;
    if (isTemplate(document)) {
        const diagnostics = templateLinter(document);
        connection.sendDiagnostics({ uri: document.uri, diagnostics });
    }
});

connection.onDocumentSymbol((documentSymbolParams: DocumentSymbolParams): SymbolInformation[] => {
    const document = documents.get(documentSymbolParams.textDocument.uri);
    return isTemplate(document) ? templateSymbolsProvider(document) : [];
});

connection.onCompletion((textDocumentPosition: TextDocumentPositionParams): CompletionItem[] => {
    const document = documents.get(textDocumentPosition.textDocument.uri);
    return isTemplate(document) ? templateCompletionProvider(document, textDocumentPosition.position) : [];
});

// Listen on the connection
connection.listen();
