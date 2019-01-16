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
} from 'vscode-languageserver';

import { utils } from 'lightning-lsp-common';
import * as auraUtils from './aura-utils';
import URI from 'vscode-uri';
import { getLanguageService, LanguageService } from './html-language-service/htmlLanguageService';
import { WorkspaceType } from './shared';
export * from './shared';
import { startServer } from './tern-server/tern-server';
import * as util from 'util';
import * as tern from 'tern';
import { interceptConsoleLogger } from './logger';
import { isNoop } from 'babel-types';
import * as fs from 'fs';
import * as infer from 'tern/lib/infer';
import * as lineColumn from 'line-column';
import { findWord, findPreviousWord, findPreviousLeftParan, countPreviousCommas } from './string-util';
import { css_beautify } from './html-language-service/beautify/beautify-css';
import * as aura from './markup/auraTags';

// Create a standard connection and let the caller decide the strategy
// Available strategies: '--node-ipc', '--stdio' or '--socket={number}'
const connection: IConnection = createConnection();
interceptConsoleLogger(connection);

// Create a document namager supporting only full document sync
const documents: TextDocuments = new TextDocuments();
documents.listen(connection);

let ternServer;
let asyncTernRequest;
let asyncFlush;
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
        const { rootUri, rootPath, capabilities } = params;
        theRootPath = rootPath;
        console.log('Starting Aura LSP server');
        ternServer = await startServer(rootPath);
        asyncTernRequest = util.promisify(ternServer.request.bind(ternServer));
        asyncFlush = util.promisify(ternServer.flush.bind(ternServer));
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
            await aura.loadStandardComponents();
            await aura.loadSystemTags();
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
        const document = documents.get(completionParams.textDocument.uri);
        if (auraUtils.isAuraMarkup(document)) {
            const htmlDocument = htmlLS.parseHTMLDocument(document);
            return htmlLS.doComplete(document, completionParams.position, htmlDocument);
        }
        try {
            await asyncFlush();
            const { completions } = await ternRequest(completionParams, 'completions', {
                types: true,
                docs: true,
                depths: true,
                guess: true,
                origins: true,
                urls: true,
                expandWordForward: true,
                caseInsensitive: true,
            });
            const items: CompletionItem[] = completions.map(completion => {
                let kind = 10;
                if (completion.type.startsWith('fn')) {
                    kind = 3;
                }
                return {
                    documentation: completion.doc,
                    detail: completion.type,
                    label: completion.name,
                    kind,
                };
            });
            return {
                isIncomplete: true,
                items,
            };
        } catch (e) {
            if (e.message && e.message.startsWith('No type found')) {
                return;
            }
            return {
                isIncomplete: true,
                items: [],
            };
        }
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
        if (auraUtils.isAuraMarkup(document)) {
            const htmlDocument = htmlLS.parseHTMLDocument(document);
            return htmlLS.doHover(document, textDocumentPosition.position, htmlDocument);
        }
        try {
            await asyncFlush();
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
        } catch (e) {
            if (e.message && e.message.startsWith('No type found')) {
                return;
            }
        }
    },
);

connection.onDefinition(
    async (textDocumentPosition: TextDocumentPositionParams): Promise<Location> => {
        await asyncFlush();
        const { file, start, end, origin } = await ternRequest(textDocumentPosition, 'definition', { preferFunction: false, doc: false });
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
    //         // await Promise.all([updateStaticResourceIndex(changes, context),
    //           updateLabelsIndex(changes, context), updateCustomComponentIndex(changes, context)]);
    //     }
    // } catch (e) {
    //     connection.sendNotification(ShowMessageNotification.type, { type: MessageType.Error, message: `Error re-indexing workspace: ${e.message}` });
    // }
});

connection.onRequest((method: string, ...params: any[]) => {
    // debugger
});

connection.onReferences(
    async (reference: ReferenceParams): Promise<Location[]> => {
        await asyncFlush();
        const { refs } = await ternRequest(reference, 'refs');
        if (refs && refs.length > 0) {
            return refs.map(ref => tern2lspLocation(ref));
        }
    },
);

connection.onSignatureHelp(
    async (signatureParams: TextDocumentPositionParams): Promise<SignatureHelp> => {
        const {
            position,
            textDocument: { uri },
        } = signatureParams;
        try {
            await asyncFlush();
            const sp = signatureParams;
            const files = ternServer.files;
            const fileName = ternServer.normalizeFilename(uriToFile(uri));
            const file = files.find(f => f.name === fileName);

            const contents = file.text;

            const offset = new lineColumn.default(contents, { origin: 0 }).toIndex(position.line, position.character);

            const left = findPreviousLeftParan(contents, offset - 1);
            const word = findPreviousWord(contents, left);

            const info = await asyncTernRequest({
                query: {
                    type: 'type',
                    file: file.name,
                    end: word.start,
                    docs: true,
                },
            });

            const commas = countPreviousCommas(contents, offset - 1);
            const cx = ternServer.cx;
            let parsed;
            infer.withContext(cx, () => {
                // @ts-ignore
                const parser = new infer.def.TypeParser(info.type);
                parsed = parser.parseType(true);
            });

            const params = parsed.args.map((arg, index) => {
                const type = arg.getType();
                return {
                    label: parsed.argNames[index],
                    documentation: type.toString() + '\n' + (type.doc || ''),
                };
            });

            const sig: SignatureInformation = {
                label: parsed.argNames[commas] || 'unknown param',
                documentation: `${info.exprName || info.name}: ${info.doc}`,
                parameters: params,
            };
            const sigs: SignatureHelp = {
                signatures: [sig],
                activeSignature: 0,
                activeParameter: commas,
            };
            return sigs;
        } catch (e) {
            // ignore
        }
    },
);
// Listen on the connection
connection.listen();
