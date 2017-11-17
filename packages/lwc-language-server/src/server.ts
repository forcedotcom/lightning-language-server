import {
    createConnection,
    IConnection,
    TextDocuments,
    InitializeParams,
    InitializeResult,
    TextDocumentPositionParams,
    CompletionList,
    CompletionItem,
    Files,
} from 'vscode-languageserver';

import templateLinter from './template/linter';

import javascriptLinter from './javascript/linter';

import { isTemplate, isJavascript } from './utils';
import { getLanguageService, LanguageService } from './html-language-service/htmlLanguageService';
import { indexLwc } from './html-language-service/parser/lwcTags';

// Create a standard connection and let the caller decide the strategy
// Availalble startegies: '--node-ipc', '--stdio' or '--socket={number}'
const connection: IConnection = createConnection();

// Create a document namager supporting only full document sync
const documents: TextDocuments = new TextDocuments();
documents.listen(connection);

let workspaceRoot: string;
let ls: LanguageService;

// TODO: See if this can be made this async
function init() {
    indexLwc();
}

connection.onInitialize((params: InitializeParams): InitializeResult => {
    const { rootUri, rootPath } = params;

    // Early exit if no workspace is opened
    const root = rootUri ? Files.uriToFilePath(rootUri) : rootPath;
    if (!root) {
        console.log(`No workspace found`);
        return { capabilities: {} };
    }

    workspaceRoot = root;
    console.log(`Starting language server at ${workspaceRoot}`);
    init();

    // Return the language server capabilities
    return {
        capabilities: {
            textDocumentSync: documents.syncKind,
            completionProvider: {
                resolveProvider: true,
            },
        },
    };
});

// Make sure to clear all the diagnostics when a document gets closed
documents.onDidClose(event => {
    connection.sendDiagnostics({ uri: event.document.uri, diagnostics: [] });
});

documents.onDidChangeContent(async change => {
    const { document } = change;
    if (isTemplate(document)) {
        const diagnostics = templateLinter(document);
        connection.sendDiagnostics({ uri: document.uri, diagnostics });
    } else if (isJavascript(document)) {
        const diagnostics = await javascriptLinter(document);
        connection.sendDiagnostics({ uri: document.uri, diagnostics });
    }
});

connection.onCompletion(
    (textDocumentPosition: TextDocumentPositionParams): CompletionList => {
        if (!ls) {
            ls = getLanguageService();
        }
        const document = documents.get(textDocumentPosition.textDocument.uri);
        const htmlDocument = ls.parseHTMLDocument(document);
        return isTemplate(document)
            ? ls.doComplete(document, textDocumentPosition.position, htmlDocument)
            : {isIncomplete: false, items: []};
    },
);

connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
    return item;
});

// Listen on the connection
connection.listen();
