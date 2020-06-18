import {
    createConnection,
    IConnection,
    TextDocuments,
    TextDocument,
    TextDocumentChangeEvent,
    Event,
    Location,
    WorkspaceFolder,
    InitializeResult,
    InitializeParams,
    TextDocumentPositionParams,
} from 'vscode-languageserver';

import { getLanguageService, LanguageService, IHTMLDataProvider, CompletionList, Hover } from 'vscode-html-languageservice';
import { compileDocument as javascriptCompileDocument } from './javascript/compiler';
import ComponentIndexer from './component-indexer';
import TypingIndexer from './typing-indexer';
import { LWCDataProvider } from './lwc-data-provider';
import templateLinter from './template/linter';
import Tag from './tag';

import URI from 'vscode-uri';
import { WorkspaceContext } from '@salesforce/lightning-lsp-common';
import { interceptConsoleLogger } from '@salesforce/lightning-lsp-common';

export default class Server {
    readonly connection: IConnection = createConnection();
    readonly documents: TextDocuments = new TextDocuments();

    context: WorkspaceContext;
    workspaceFolders: WorkspaceFolder[];
    workspaceRoots: string[];
    dataProvider: IHTMLDataProvider;
    componentIndexer: ComponentIndexer;
    typingIndexer: TypingIndexer;
    languageService: LanguageService;

    constructor() {
        interceptConsoleLogger(this.connection);
        this.connection.onInitialize(this.onInitialize.bind(this));
        this.connection.onCompletion(this.onCompletion.bind(this));
        this.connection.onHover(this.onHover.bind(this));

        this.documents.listen(this.connection);
        this.documents.onDidChangeContent(this.onDidChangeContent.bind(this));
    }

    onInitialize(params: InitializeParams) {
        this.workspaceFolders = params.workspaceFolders;
        this.workspaceRoots = this.workspaceFolders.map(folder => URI.parse(folder.uri).fsPath);
        this.context = new WorkspaceContext(this.workspaceRoots);
        this.componentIndexer = new ComponentIndexer({ workspaceRoot: this.workspaceRoots[0] });
        this.dataProvider = new LWCDataProvider({ indexer: this.componentIndexer });
        this.typingIndexer = new TypingIndexer({ workspaceRoot: this.workspaceRoots[0] });
        this.languageService = getLanguageService({
            customDataProviders: [this.dataProvider],
        });

        this.componentIndexer.init();
        // this.typingIndexer.init();

        return this.capabilities;
    }

    get capabilities(): InitializeResult {
        return {
            capabilities: {
                textDocumentSync: this.documents.syncKind,
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
    }

    async onCompletion(textDocumentPosition: TextDocumentPositionParams): Promise<CompletionList> {
        const document = this.documents.get(textDocumentPosition.textDocument.uri);
        if (!(await this.context.isLWCTemplate(document))) {
            return { isIncomplete: false, items: [] };
        }
        const htmlDocument = this.languageService.parseHTMLDocument(document);
        return this.languageService.doComplete(document, textDocumentPosition.position, htmlDocument);
    }

    async onHover(textDocumentPosition: TextDocumentPositionParams): Promise<Hover> {
        const document = this.documents.get(textDocumentPosition.textDocument.uri);
        if (!(await this.context.isLWCTemplate(document))) {
            return null;
        }
        const htmlDocument = this.languageService.parseHTMLDocument(document);
        return this.languageService.doHover(document, textDocumentPosition.position, htmlDocument);
    }

    async onDidChangeContent(changeEvent: any): Promise<void> {
        // TODO: when hovering on an html tag, this is called for the target .js document (bug in vscode?)
        const { document } = changeEvent;
        const { uri } = document;
        if (await this.context.isLWCTemplate(document)) {
            const diagnostics = templateLinter(document);
            this.connection.sendDiagnostics({ uri, diagnostics });
        }
        if (await this.context.isLWCJavascript(document)) {
            const { metadata, diagnostics } = await javascriptCompileDocument(document);
            this.connection.sendDiagnostics({ uri, diagnostics });
            if (metadata) {
                const tag: Tag = this.componentIndexer.findTagByURI(uri);
                if (tag) tag.metadata = metadata;
            }
        }
    }

    listen() {
        this.connection.listen();
    }
}
