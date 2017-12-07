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
} from 'vscode-languageserver';

import { WorkspaceContext } from './context';

import templateLinter from './template/linter';
import { compileDocument as javascriptCompileDocument, extractAttributes } from './javascript/compiler';
import * as utils from './utils';
import { updateLabelsIndex } from './metadata-utils/custom-labels-util';
import { updateStaticResourceIndex } from './metadata-utils/static-resources-util';
import {
    updateCustomComponentIndex,
    setCustomAttributes,
    getLwcByTag,
} from './metadata-utils/custom-components-util';
import {
    getLanguageService,
    LanguageService,
} from './html-language-service/htmlLanguageService';
import URI from 'vscode-uri';

// Create a standard connection and let the caller decide the strategy
// Available strategies: '--node-ipc', '--stdio' or '--socket={number}'
const connection: IConnection = createConnection();

// Create a document namager supporting only full document sync
const documents: TextDocuments = new TextDocuments();
documents.listen(connection);

let ls: LanguageService;
let context: WorkspaceContext;

connection.onInitialize(async (params: InitializeParams): Promise<InitializeResult> => {
    const { rootUri, rootPath } = params;

    // Early exit if no workspace is opened
    const workspaceRoot = path.resolve(rootUri ? URI.parse(rootUri).path : rootPath);
    if (!workspaceRoot) {
        console.log(`No workspace found`);
        return { capabilities: {} };
    }

    console.log(`Starting language server at ${workspaceRoot}`);
    const startTime = process.hrtime();
    context = WorkspaceContext.createFrom(workspaceRoot);
    context.configureAndIndex();
    console.log('     ... language server started in ' + utils.elapsedMillis(startTime), context);

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
    const { uri } = document;
    if (context.isLWCTemplate(document)) {
        const diagnostics = templateLinter(document);
        connection.sendDiagnostics({ uri, diagnostics });
    } else if (context.isLWCJavascript(document)) {
        const { result, diagnostics } = await javascriptCompileDocument(document);
        connection.sendDiagnostics({ uri, diagnostics });
        if (result) {
            const attributes = extractAttributes(result.metadata);
            // TODO: use namespace+tagName to also work outside sfdx custom components
            const tagName = uri.substring(uri.lastIndexOf('/') + 1, uri.lastIndexOf('.'));
            if (attributes.length > 0 || getLwcByTag(tagName)) {
                // has @apis or known tag => assuming is the main .js file for the module
                setCustomAttributes(tagName, attributes, context);
            }
        }
    }
});

connection.onCompletion(
    (textDocumentPosition: TextDocumentPositionParams): CompletionList => {
        if (!ls) {
            ls = getLanguageService();
        }
        const document = documents.get(textDocumentPosition.textDocument.uri);
        const htmlDocument = ls.parseHTMLDocument(document);
        return context.isLWCTemplate(document)
            ? ls.doComplete(document, textDocumentPosition.position, htmlDocument)
            : { isIncomplete: false, items: [] };
    },
);

connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
    return item;
});

// Listen on the connection
connection.listen();

connection.onDidChangeWatchedFiles(async (change: DidChangeWatchedFilesParams) => {
    console.log('onDidChangeWatchedFiles...');
    return Promise.all([
        updateStaticResourceIndex(change.changes, context),
        updateLabelsIndex(change.changes, context),
        updateCustomComponentIndex(change.changes, context),
    ]);
});
