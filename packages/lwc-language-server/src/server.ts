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
    RequestType,
    RegistrationRequest,
} from 'vscode-languageserver';

import { LWCIndexer } from './indexer';
import templateLinter from './template/linter';
import { compileDocument as javascriptCompileDocument } from './javascript/compiler';
import { WorkspaceContext, utils, shared, interceptConsoleLogger } from '@salesforce/lightning-lsp-common';
import { getLanguageService, LanguageService } from '@salesforce/lightning-lsp-common';
import URI from 'vscode-uri';
import { addCustomTagFromResults, getLwcTags, getLwcByTag } from './metadata-utils/custom-components-util';
import { getLwcTagProvider } from './markup/lwcTags';
import decamelize from 'decamelize';
const { WorkspaceType } = shared;
// Create a standard connection and let the caller decide the strategy
// Available strategies: '--node-ipc', '--stdio' or '--socket={number}'

const connection: IConnection = createConnection();
interceptConsoleLogger(connection);

// Create a document namager supporting only full document sync
const documents: TextDocuments = new TextDocuments();
documents.listen(connection);

let htmlLS: LanguageService;
let context: WorkspaceContext;

connection.onInitialize(
    async (params: InitializeParams): Promise<InitializeResult> => {
        const { workspaceFolders } = params;

        const workspaceRoots: string[] = [];
        for (const folder of workspaceFolders) {
            workspaceRoots.push(path.resolve(URI.parse(folder.uri).fsPath));
        }
        try {
            if (workspaceRoots.length === 0) {
                console.warn(`No workspace found`);
                return { capabilities: {} };
            }

            for (const root of workspaceRoots) {
                console.info(`Starting [[LWC]] language server at ${root}`);
            }
            const startTime = process.hrtime();
            context = new WorkspaceContext(workspaceRoots);

            context.configureProject();
            const lwcIndexer = new LWCIndexer(context);

            lwcIndexer.configureAndIndex();

            context.addIndexingProvider({ name: 'lwc', indexer: lwcIndexer });
            htmlLS = getLanguageService();
            htmlLS.addTagProvider(getLwcTagProvider());
            console.info('     ... language server started in ' + utils.elapsedMillis(startTime));
            return {
                capabilities: {
                    textDocumentSync: documents.syncKind,
                    completionProvider: {
                        resolveProvider: true,
                    },
                    hoverProvider: true,
                    definitionProvider: true,
                    workspace: {
                        workspaceFolders: {
                            supported: true,
                        },
                    },
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
    if (await context.isLWCTemplate(document)) {
        const diagnostics = templateLinter(document);
        connection.sendDiagnostics({ uri, diagnostics });
    } else if (await context.isLWCJavascript(document)) {
        const { metadata, diagnostics } = await javascriptCompileDocument(document);
        connection.sendDiagnostics({ uri, diagnostics });
        if (metadata) {
            // writeConfigs is set to false to avoid config updates on every keystroke.
            addCustomTagFromResults(context, uri, metadata, context.type === WorkspaceType.SFDX, false);
        }
    }
});

documents.onDidSave(async change => {
    const { document } = change;
    const { uri } = document;
    if (await context.isLWCJavascript(document)) {
        const { metadata } = await javascriptCompileDocument(document);
        if (metadata) {
            addCustomTagFromResults(context, uri, metadata, context.type === WorkspaceType.SFDX);
        }
    }
});

connection.onCompletion(
    async (textDocumentPosition: TextDocumentPositionParams): Promise<CompletionList> => {
        const document = documents.get(textDocumentPosition.textDocument.uri);
        if (!(await context.isLWCTemplate(document))) {
            return { isIncomplete: false, items: [] };
        }
        const htmlDocument = htmlLS.parseHTMLDocument(document);
        return htmlLS.doComplete(document, textDocumentPosition.position, htmlDocument, {
            isSfdxProject: context.type === WorkspaceType.SFDX,
            useAttributeValueQuotes: false,
        });
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
        if (!(await context.isLWCTemplate(document))) {
            return null;
        }
        const htmlDocument = htmlLS.parseHTMLDocument(document);
        return htmlLS.doHover(document, textDocumentPosition.position, htmlDocument);
    },
);

function findJavascriptProperty(valueProperty: string, textDocumentPosition: TextDocumentPositionParams) {
    // couldn't find it within the markup file, try looking for it as a javascript property
    const fsPath = URI.parse(textDocumentPosition.textDocument.uri).fsPath;
    const parsedPath = path.parse(fsPath);
    const componentName = decamelize(parsedPath.name, '-');
    const namespace = path.basename(path.dirname(parsedPath.dir));
    const tagInfo = getLwcByTag(namespace + '-' + componentName);
    if (tagInfo) {
        for (const property of [...tagInfo.properties, ...tagInfo.methods]) {
            if (property.name === valueProperty) {
                return {
                    uri: URI.file(tagInfo.file).toString(),
                    range: {
                        start: {
                            character: property.loc.start.column,
                            line: property.loc.start.line - 1,
                        },
                        end: {
                            character: property.loc.end.column,
                            line: property.loc.end.line - 1,
                        },
                    },
                };
            }
        }
    }
    return null;
}
connection.onDefinition(
    async (textDocumentPosition: TextDocumentPositionParams): Promise<Location> => {
        const document = documents.get(textDocumentPosition.textDocument.uri);
        if (!(await context.isLWCTemplate(document))) {
            return null;
        }
        const htmlDocument = htmlLS.parseHTMLDocument(document);
        let def = htmlLS.findDefinition(document, textDocumentPosition.position, htmlDocument);
        if (!def) {
            def = htmlLS.getPropertyBindingTemplateDeclaration(document, textDocumentPosition.position, htmlDocument);
            if (!def) {
                const valueProperty = htmlLS.getPropertyBindingValue(document, textDocumentPosition.position, htmlDocument);
                if (valueProperty) {
                    def = findJavascriptProperty(valueProperty, textDocumentPosition);
                }
            }
        }
        return def;
    },
);

// Listen on the connection
connection.listen();

connection.onDidChangeWatchedFiles(async (change: DidChangeWatchedFilesParams) => {
    try {
        const indexer: LWCIndexer = context.getIndexingProvider('lwc') as LWCIndexer;
        return indexer.handleWatchedFiles(context, change);
    } catch (e) {
        connection.sendNotification(ShowMessageNotification.type, { type: MessageType.Error, message: `Error re-indexing workspace: ${e.message}` });
    }
});

connection.onRequest('salesforce/listComponents', () => {
    const tags = getLwcTags();
    return JSON.stringify([...tags]);
});
