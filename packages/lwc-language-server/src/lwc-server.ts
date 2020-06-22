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

import {
    getLanguageService,
    LanguageService,
    IHTMLDataProvider,
    HTMLDocument,
    CompletionList,
    TokenType,
    ScannerState,
    Hover,
    CompletionItem,
} from 'vscode-html-languageservice';

import ComponentIndexer from './component-indexer';
import TypingIndexer from './typing-indexer';
import templateLinter from './template/linter';
import Tag from './tag';
import URI from 'vscode-uri';

import { compileDocument as javascriptCompileDocument } from './javascript/compiler';
import { LWCDataProvider } from './lwc-data-provider';
import { WorkspaceContext } from '@salesforce/lightning-lsp-common';
import { interceptConsoleLogger } from '@salesforce/lightning-lsp-common';

export enum Token {
    Tag = 'tag',
    AttributeKey = 'attributeKey',
    AttributeValue = 'attributeValue',
    Content = 'content',
}

type CursorInfo = {
    name: string;
    type: Token;
    tag?: string;
};

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
        this.connection.onCompletionResolve(this.onCompletionResolve.bind(this));
        this.connection.onHover(this.onHover.bind(this));
        this.connection.onShutdown(this.onShutdown.bind(this));

        this.documents.listen(this.connection);
        this.documents.onDidChangeContent(this.onDidChangeContent.bind(this));
        // this.documents.onDidSave(this.onDidSave.bind(this));
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
        this.typingIndexer.init();

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
        const htmlDocument: HTMLDocument = this.languageService.parseHTMLDocument(document);
        return this.languageService.doComplete(document, textDocumentPosition.position, htmlDocument);
    }

    onCompletionResolve(item: CompletionItem): CompletionItem {
        return item;
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
                if (tag) tag.updateMetadata(metadata);
            }
        }
    }

    async onDidSave(change: TextDocumentChangeEvent) {
        const { document } = change;
        const { uri } = document;
        if (await this.context.isLWCJavascript(document)) {
            const { metadata } = await javascriptCompileDocument(document);
            if (metadata) {
                const tag = this.componentIndexer.findTagByURI(uri);
                if (tag) {
                    tag.updateMetadata(metadata);
                } else {
                    const newTag = new Tag(metadata);
                    this.componentIndexer.tags.set(newTag.name, newTag);
                }
            }
        }
    }

    onShutdown() {
        this.componentIndexer.persistCustomComponents();
    }

    cursorInfo({ textDocument: { uri }, position }: TextDocumentPositionParams, document?: TextDocument): CursorInfo | null {
        const doc = document || this.documents.get(uri);
        const offset = doc.offsetAt(position);
        const scanner = this.languageService.createScanner(doc.getText());
        let token;
        let tag;

        do {
            token = scanner.scan();
            if (token === TokenType.StartTag) tag = scanner.getTokenText();
        } while (token !== TokenType.EOS && scanner.getTokenEnd() <= offset);

        switch (token) {
            case TokenType.StartTag:
            case TokenType.EndTag:
                return {
                    type: Token.Tag,
                    name: tag,
                    tag,
                };
            case TokenType.AttributeName:
                return {
                    type: Token.AttributeKey,
                    tag,
                    name: scanner.getTokenText(),
                };
            case TokenType.AttributeValue:
                return {
                    type: Token.AttributeValue,
                    tag,
                    name: scanner.getTokenText(),
                };
            case TokenType.Content:
                return {
                    type: Token.Content,
                    tag,
                    name: scanner.getTokenText(),
                };
        }

        return null;
    }

    listen() {
        this.connection.listen();
    }
}
