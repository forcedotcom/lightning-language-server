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
    FileChangeType,
    NotificationType,
} from 'vscode-languageserver';

import * as auraUtils from './aura-utils';
import URI from 'vscode-uri';
import { getLanguageService, LanguageService } from 'lightning-lsp-common';
export * from './shared';
import { startServer } from './tern-server/tern-server';
import * as util from 'util';
import * as tern from 'tern';
import * as infer from 'tern/lib/infer';
import LineColumnFinder from 'line-column';
import { findPreviousWord, findPreviousLeftParan, countPreviousCommas } from './string-util';
import { WorkspaceContext, utils, interceptConsoleLogger, TagInfo } from 'lightning-lsp-common';
import { LWCIndexer } from 'lwc-language-server';
import AuraIndexer from './aura-indexer/indexer';
import { toResolvedPath } from 'lightning-lsp-common/lib/utils';
import { setIndexer } from './markup/auraTags';
import { WorkspaceType } from 'lightning-lsp-common/lib/shared';
import { readFileSync, readdirSync, statSync } from 'fs';
import { getAuraTagProvider } from './markup/auraTags';

interface ITagParams {
    taginfo: TagInfo;
}

const tagAdded: NotificationType<ITagParams, void> = new NotificationType<ITagParams, void>('salesforce/tagAdded');
const tagDeleted: NotificationType<string, void> = new NotificationType<string, void>('salesforce/tagDeleted');
const tagsCleared: NotificationType<void, void> = new NotificationType<void, void>('salesforce/tagsCleared');

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
let context: WorkspaceContext;

function* walkSync(dir: string) {
    const files = readdirSync(dir);

    for (const file of files) {
        const pathToFile = path.join(dir, file);
        const isDirectory = statSync(pathToFile).isDirectory();
        if (isDirectory) {
            yield* walkSync(pathToFile);
        } else {
            yield pathToFile;
        }
    }
}
async function ternInit() {
    await asyncTernRequest({
        query: {
            type: 'ideInit',
            unloadDefs: true,
            // shouldFilter: true,
        },
    });
    const resources = path.join(__dirname, '../resources/aura');
    const found = [...walkSync(resources)];
    let [lastFile, lastText] = [undefined, undefined];
    for (const file of found) {
        if (file.endsWith('.js')) {
            const data = readFileSync(file, 'utf-8');
            // HACK HACK HACK - glue it all together baby!
            if (file.endsWith('AuraInstance.js')) {
                lastFile = file;
                lastText = data.concat(`\nwindow['$A'] = new AuraInstance();\n`);
            } else {
                ternServer.addFile(file, data);
            }
        }
    }
    ternServer.addFile(lastFile, lastText);
}

const init = utils.memoize(ternInit.bind(this));

connection.onInitialize(
    async (params: InitializeParams): Promise<InitializeResult> => {
        const { rootUri, rootPath, capabilities } = params;

        const workspaceRoot = path.resolve(rootUri ? URI.parse(rootUri).fsPath : rootPath);
        theRootPath = workspaceRoot;
        try {
            if (!workspaceRoot) {
                console.warn(`No workspace found`);
                return { capabilities: {} };
            }

            console.info(`Starting *AURA* language server at ${workspaceRoot}`);
            const startTime = process.hrtime();
            ternServer = await startServer(rootPath);

            context = new WorkspaceContext(workspaceRoot);
            context.configureProject();

            const auraIndexer = new AuraIndexer(context);
            setIndexer(auraIndexer);

            auraIndexer.tagEvents.on('set', (tag: TagInfo) => {
                 connection.sendNotification(tagAdded, { taginfo: tag });
            });
            auraIndexer.tagEvents.on('delete', (tag: string) => {
                connection.sendNotification(tagDeleted, tag);
            });
            auraIndexer.tagEvents.on('clear', () => {
                connection.sendNotification(tagsCleared, undefined);
            });

            startIndexing();

            asyncTernRequest = util.promisify(ternServer.request.bind(ternServer));
            asyncFlush = util.promisify(ternServer.flush.bind(ternServer));

            init();

            htmlLS = getLanguageService();
            console.info('... language server started in ' + utils.elapsedMillis(startTime));

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

function startIndexing() {
    setTimeout( async () => {
        const indexer =  context.getIndexingProvider('aura') as AuraIndexer;
        connection.sendNotification('salesforce/indexingStarted');
        await indexer.configureAndIndex();
        connection.sendNotification('salesforce/indexingEnded');
    }, 0);
}

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

            const list: CompletionList = htmlLS.doComplete(document, completionParams.position, htmlDocument);
            return list;
        }
        try {
            await init();
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
                let kind = 18;
                if (completion.type && completion.type.startsWith('fn')) {
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
            const hover = htmlLS.doHover(document, textDocumentPosition.position, htmlDocument);
            return hover;
        }
        try {
            await init();
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
        const document = documents.get(textDocumentPosition.textDocument.uri);
        if (auraUtils.isAuraMarkup(document)) {
            const htmlDocument = htmlLS.parseHTMLDocument(document);

            // TODO: refactor into method
            const offset = document.offsetAt(textDocumentPosition.position);
            const node = htmlDocument.findNodeAt(offset);
            if (!node || !node.tag) {
                return null;
            }
            const tagProviders = htmlLS.getTagProviders().filter(p => p.isApplicable(document.languageId));
            let location: Location;
            for (const provider of tagProviders) {
                provider.collectTags((t, label, info) => {
                    if (t === node.tag || t === node.tag.toLowerCase()) {
                        if (info.location && info.location.uri && info.location.range) {
                            location = Location.create(info.location.uri, info.location.range);
                        }
                    }
                });
            }
            return location;
        }
        try {
            await init();
            await asyncFlush();
            const { file, start, end, origin } = await ternRequest(textDocumentPosition, 'definition', { preferFunction: false, doc: false });
            if (file) {
                if (file === 'Aura') {
                    return;
                } else if (file.indexOf('/resources/aura/') >= 0) {
                    const slice = file.slice(file.indexOf('/resources/aura/'));
                    const real = path.join(__dirname, '..', slice);
                    return {
                        uri: URI.file(real).toString(),
                        range: tern2lspRange({ start, end }),
                    };
                }
                return tern2lspLocation({ file, start, end });
            }
        } catch (e) {
            if (e.message && e.message.startsWith('No type found')) {
                return;
            }
        }
    },
);

connection.onDidChangeWatchedFiles(async (change: DidChangeWatchedFilesParams) => {
    console.info('aura onDidChangeWatchedFiles...');
    const changes = change.changes;

    try {
        const lwcIndexer =  context.getIndexingProvider('lwc') as LWCIndexer;
        lwcIndexer.handleWatchedFiles(context, change);
        if (utils.isAuraRootDirectoryCreated(context, changes)) {
            await context.getIndexingProvider('aura').resetIndex();
            await context.getIndexingProvider('aura').configureAndIndex();
            // re-index everything on directory deletions as no events are reported for contents of deleted directories
            const startTime = process.hrtime();
            console.info('reindexed workspace in ' + utils.elapsedMillis(startTime) + ', directory was deleted:', changes);
            return;
        } else {
            let files = 0;
            for (const event of changes) {
                if (event.type === FileChangeType.Deleted && utils.isAuraWatchedDirectory(context, event.uri)) {
                    const dir = toResolvedPath(event.uri);
                    const indexer = context.getIndexingProvider('aura') as AuraIndexer;
                    indexer.clearTagsforDirectory(dir, context.type === WorkspaceType.SFDX);
                    files++;
                } else {
                    const file = toResolvedPath(event.uri);
                    if (/.*(.app|.cmp|.intf|.evt|.lib)$/.test(file)) {
                        const indexer = context.getIndexingProvider('aura') as AuraIndexer;
                        await indexer.indexFile(file, context.type === WorkspaceType.SFDX);
                        files++;
                    }
                }
            }
        }
    } catch (e) {
        connection.sendNotification(ShowMessageNotification.type, { type: MessageType.Error, message: `Error re-indexing workspace: ${e.message}` });
    }
});

connection.onRequest((method: string, ...params: any[]) => {
    // debugger
});

connection.onReferences(
    async (reference: ReferenceParams): Promise<Location[]> => {
        await init();
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
            await init();
            await asyncFlush();
            const sp = signatureParams;
            const files = ternServer.files;
            const fileName = ternServer.normalizeFilename(uriToFile(uri));
            const file = files.find(f => f.name === fileName);

            const contents = file.text;

            const offset = new LineColumnFinder(contents, { origin: 0 }).toIndex(position.line, position.character);

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

connection.onRequest('salesforce/listComponents', () => {
    const indexer =  context.getIndexingProvider('aura') as AuraIndexer;
    const tags = indexer.getAuraTags();
    const result = JSON.stringify([...tags]);
    return result;
});

connection.onRequest('salesforce/listNamespaces', () => {
    const indexer =  context.getIndexingProvider('aura') as AuraIndexer;
    const tags = indexer.getAuraNamespaces();
    const result = JSON.stringify(tags);
    return result;
});
