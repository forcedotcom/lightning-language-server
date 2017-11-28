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
    Files,
} from 'vscode-languageserver';

import templateLinter from './template/linter';
import javascriptLinter from './javascript/linter';
import {
    isTemplate,
    isJavascript,
} from './utils';
import {
    indexCustomLabels,
    updateLabelsIndex,
} from './metadata-utils/custom-labels-util';
import {
    indexStaticResources,
    updateStaticResourceIndex,
} from "./metadata-utils/static-resources-util";
import {
    indexLwc,
    updateCustomComponentIndex,
} from "./metadata-utils/custom-components-util";
import {
    getLanguageService,
    LanguageService,
} from './html-language-service/htmlLanguageService';
import * as sfdxConfig from './sfdx/sfdxConfig';

// Create a standard connection and let the caller decide the strategy
// Available strategies: '--node-ipc', '--stdio' or '--socket={number}'
const connection: IConnection = createConnection();

// Create a document namager supporting only full document sync
const documents: TextDocuments = new TextDocuments();
documents.listen(connection);

let ls: LanguageService;
let workspaceRoot: string;

async function init() {
    sfdxConfig.configSfdxProject(workspaceRoot);
    return Promise.all([
        indexLwc(workspaceRoot), // TODO: See if this can be made this async
        indexStaticResources(workspaceRoot),
        indexCustomLabels(workspaceRoot),
    ]);
}

connection.onInitialize((params: InitializeParams): InitializeResult => {
    const { rootUri, rootPath } = params;

    // Early exit if no workspace is opened
    workspaceRoot = rootUri ? Files.uriToFilePath(rootUri) : rootPath;
    if (!workspaceRoot) {
        console.log(`No workspace found`);
        return { capabilities: {} };
    }

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

connection.onDidChangeWatchedFiles(async (change: DidChangeWatchedFilesParams) => {
    connection.console.log('We recevied an file change event');
    console.log('onDidChangeWatchedFiles...');
    return Promise.all([
        updateStaticResourceIndex(workspaceRoot, change.changes),
        updateLabelsIndex(workspaceRoot, change.changes),
        updateCustomComponentIndex(change.changes),
    ]);
});
