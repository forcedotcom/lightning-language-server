import {
    createConnection,
    IConnection,
    TextDocuments,
    TextDocument,
    TextDocumentChangeEvent,
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
import { WorkspaceContext, interceptConsoleLogger } from '@salesforce/lightning-lsp-common';

export const propertyRegex: RegExp = new RegExp(/\{(?<property>\w+)\.*.*\}/);
export const iteratorRegex: RegExp = new RegExp(/iterator:(?<name>\w+)/);

export enum Token {
    Tag = 'tag',
    AttributeKey = 'attributeKey',
    AttributeValue = 'attributeValue',
    DynamicAttributeValue = 'dynamicAttributeValue',
    Content = 'content',
    DynamicContent = 'dynamicContent',
}

type CursorInfo = {
    name: string;
    type: Token;
    tag?: string;
    range?: any;
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
        this.connection.onInitialize(this.onInitialize.bind(this));
        this.connection.onCompletion(this.onCompletion.bind(this));
        this.connection.onCompletionResolve(this.onCompletionResolve.bind(this));
        this.connection.onHover(this.onHover.bind(this));
        this.connection.onShutdown(this.onShutdown.bind(this));
        this.connection.onDefinition(this.onDefinition.bind(this));

        this.documents.listen(this.connection);
        this.documents.onDidChangeContent(this.onDidChangeContent.bind(this));
        this.documents.onDidSave(this.onDidSave.bind(this));
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

    onDefinition(params: TextDocumentPositionParams): Location[] | Location | null {
        const cursorInfo: CursorInfo = this.cursorInfo(params);

        if (!cursorInfo) return null;

        const tag = this.componentIndexer.tags.get(cursorInfo.tag);

        switch (cursorInfo.type) {
            case Token.Tag:
                return tag?.allLocations;

            case Token.AttributeKey:
                return tag?.attribute(cursorInfo.name)?.location;

            case Token.DynamicContent:
            case Token.DynamicAttributeValue:
                if (cursorInfo.range) {
                    return Location.create(params.textDocument.uri, cursorInfo.range);
                } else {
                    return this.componentIndexer.findTagByURI(params.textDocument.uri.replace('.html', '.js'))?.attribute(cursorInfo.name)?.location;
                }
        }
    }

    cursorInfo({ textDocument: { uri }, position }: TextDocumentPositionParams, document?: TextDocument): CursorInfo | null {
        const doc = document || this.documents.get(uri);
        const offset = doc.offsetAt(position);
        const scanner = this.languageService.createScanner(doc.getText());
        let token;
        let tag;
        let attributeName;
        const iterators = [];

        do {
            token = scanner.scan();
            if (token === TokenType.StartTag) {
                tag = scanner.getTokenText();
            }
            if (token === TokenType.StartTag) {
                tag = scanner.getTokenText();
            }
            if (token === TokenType.AttributeName) {
                attributeName = scanner.getTokenText();
                const iterator = iteratorRegex.exec(attributeName);
                if (iterator) {
                    iterators.unshift({
                        name: iterator.groups.name,
                        range: {
                            start: doc.positionAt(scanner.getTokenOffset() + 9),
                            end: doc.positionAt(scanner.getTokenEnd()),
                        },
                    });
                }
            }
            if (token === TokenType.AttributeValue && attributeName === 'for:item') {
                iterators.unshift({
                    name: scanner.getTokenText().replace(/"|'/g, ''),
                    range: {
                        start: doc.positionAt(scanner.getTokenOffset()),
                        end: doc.positionAt(scanner.getTokenEnd()),
                    },
                });
            }
        } while (token !== TokenType.EOS && scanner.getTokenEnd() <= offset);

        const content = scanner.getTokenText();

        switch (token) {
            case TokenType.StartTag:
            case TokenType.EndTag: {
                return { type: Token.Tag, name: tag, tag };
            }
            case TokenType.AttributeName: {
                return { type: Token.AttributeKey, tag, name: content };
            }
            case TokenType.AttributeValue: {
                const match = propertyRegex.exec(content);
                if (match) {
                    const item = iterators.find(i => i.name === match.groups.property) || null;
                    return {
                        type: Token.DynamicAttributeValue,
                        name: match.groups.property,
                        range: item?.range,
                        tag,
                    };
                } else {
                    return { type: Token.AttributeValue, name: content, tag };
                }
            }
            case TokenType.Content: {
                const relativeOffset: number = offset - scanner.getTokenOffset();
                const match = findDynamicContent(content, relativeOffset);

                if (match) {
                    const item = iterators.find(i => i.name === match) || null;

                    return {
                        type: Token.DynamicContent,
                        name: match,
                        range: item?.range,
                        tag,
                    };
                } else {
                    return {
                        type: Token.Content,
                        tag,
                        name: content,
                    };
                }
            }
        }

        return null;
    }

    listen() {
        interceptConsoleLogger(this.connection);
        this.connection.listen();
    }
}

export function findDynamicContent(text: string, offset: number) {
    const regex: RegExp = new RegExp(/\{(?<property>\w+)\.*|\:*\w+\}/, 'g');
    let match = regex.exec(text);
    while (match && offset > match.index) {
        if (match.groups && match.groups.property && offset > match.index && regex.lastIndex > offset) {
            return match.groups.property;
        }
        match = regex.exec(text);
    }
    return null;
}
