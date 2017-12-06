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

import { IWorkspaceContext } from './context';

import templateLinter from './template/linter';
import { compileDocument as javascriptCompileDocument, extractAttributes } from './javascript/compiler';
import * as utils from './utils';
import {
    indexCustomLabels,
    updateLabelsIndex,
} from './metadata-utils/custom-labels-util';
import {
    indexStaticResources,
    updateStaticResourceIndex,
} from './metadata-utils/static-resources-util';
import {
    loadStandardLwc,
    indexCustomComponents,
    updateCustomComponentIndex,
    setCustomAttributes,
    getLwcByTag,
} from './metadata-utils/custom-components-util';
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
let workspaceContext: IWorkspaceContext;

async function init(workspaceRoot: string): Promise<IWorkspaceContext> {
    const namespaceRoots = utils.findNamespaceRoots(workspaceRoot);
    const sfdxProject = sfdxConfig.configSfdxProject(workspaceRoot);
    const indexingTasks: Array<Promise<void>> = [];
    indexingTasks.push(loadStandardLwc());
    indexingTasks.push(indexCustomComponents(namespaceRoots, sfdxProject));
    if (sfdxProject) {
        indexingTasks.push(indexStaticResources(workspaceRoot));
        indexingTasks.push(indexCustomLabels(workspaceRoot));
    }
    await Promise.all(indexingTasks);
    return { workspaceRoot, sfdxProject, namespaceRoots };
}

connection.onInitialize((params: InitializeParams): Promise<InitializeResult> => {
    return onInitialize(params);
});

async function onInitialize(params: InitializeParams): Promise<InitializeResult> {
    const { rootUri, rootPath } = params;

    // Early exit if no workspace is opened
    const workspaceRoot = rootUri ? Files.uriToFilePath(rootUri) : rootPath;
    if (!workspaceRoot) {
        console.log(`No workspace found`);
        return { capabilities: {} };
    }

    console.log(`Starting language server at ${workspaceRoot}`);
    const startTime = process.hrtime();
    workspaceContext = await init(workspaceRoot);
    console.log('     ... language server started in ' + utils.elapsedMillis(startTime), workspaceContext);

    // Return the language server capabilities
    return {
        capabilities: {
            textDocumentSync: documents.syncKind,
            completionProvider: {
                resolveProvider: true,
            },
        },
    };
}

// Make sure to clear all the diagnostics when a document gets closed
documents.onDidClose(event => {
    connection.sendDiagnostics({ uri: event.document.uri, diagnostics: [] });
});

documents.onDidChangeContent(async change => {
    console.log('onDidChangeContent: ', change.document.uri);
    const { document } = change;
    const { uri } = document;
    if (utils.isTemplate(document)) {
        const diagnostics = templateLinter(document);
        connection.sendDiagnostics({ uri, diagnostics });
    } else if (utils.isJavascript(document)) {
        const { result, diagnostics } = await javascriptCompileDocument(document);
        connection.sendDiagnostics({ uri, diagnostics });
        if (result) {
            const attributes = extractAttributes(result.metadata);
            // TODO: use namespace+tagName to also work outside sfdx custom components
            const tagName = uri.substring(uri.lastIndexOf('/') + 1, uri.lastIndexOf('.'));
            if (attributes.length > 0 || getLwcByTag(tagName)) {
                // has @apis or known tag => assuming is the main .js file for the module
                setCustomAttributes(tagName, attributes, workspaceContext);
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
        return utils.isTemplate(document)
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
    connection.console.log('We recevied an file change event');
    console.log('onDidChangeWatchedFiles...');
    return Promise.all([
        updateStaticResourceIndex(change.changes, workspaceContext),
        updateLabelsIndex(change.changes, workspaceContext),
        updateCustomComponentIndex(change.changes, workspaceContext),
    ]);
});
