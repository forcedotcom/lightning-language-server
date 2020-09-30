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
    HTMLDocument,
    CompletionList,
    TokenType,
    Hover,
    CompletionItem,
    CompletionItemKind,
} from 'vscode-html-languageservice';

import { compileDocument as javascriptCompileDocument } from './javascript/compiler';
import { AuraDataProvider } from './aura-data-provider';
import { LWCDataProvider } from './lwc-data-provider';
import { Metadata } from './decorators';
import { WorkspaceContext, interceptConsoleLogger } from '@salesforce/lightning-lsp-common';

import ComponentIndexer from './component-indexer';
import TypingIndexer from './typing-indexer';
import templateLinter from './template/linter';
import Tag from './tag';
import { URI } from 'vscode-uri';

export const propertyRegex = new RegExp(/\{(?<property>\w+)\.*.*\}/);
export const iteratorRegex = new RegExp(/iterator:(?<name>\w+)/);

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

export function findDynamicContent(text: string, offset: number): any {
    const regex = new RegExp(/\{(?<property>\w+)\.*|\:*\w+\}/, 'g');
    let match = regex.exec(text);
    while (match && offset > match.index) {
        if (match.groups && match.groups.property && offset > match.index && regex.lastIndex > offset) {
            return match.groups.property;
        }
        match = regex.exec(text);
    }
    return null;
}

export default class Server {
    readonly connection: IConnection = createConnection();
    readonly documents: TextDocuments = new TextDocuments();
    context: WorkspaceContext;
    workspaceFolders: WorkspaceFolder[];
    workspaceRoots: string[];
    componentIndexer: ComponentIndexer;
    typingIndexer: TypingIndexer;
    languageService: LanguageService;
    auraDataProvider: AuraDataProvider;
    lwcDataProvider: LWCDataProvider;

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

    async onInitialize(params: InitializeParams): Promise<InitializeResult> {
        this.workspaceFolders = params.workspaceFolders;
        this.workspaceRoots = this.workspaceFolders.map(folder => URI.parse(folder.uri).fsPath);
        this.context = new WorkspaceContext(this.workspaceRoots);
        this.componentIndexer = new ComponentIndexer({ workspaceRoot: this.workspaceRoots[0] });
        this.lwcDataProvider = new LWCDataProvider({ indexer: this.componentIndexer });
        this.auraDataProvider = new AuraDataProvider({ indexer: this.componentIndexer });
        this.typingIndexer = new TypingIndexer({ workspaceRoot: this.workspaceRoots[0] });
        this.languageService = getLanguageService({
            customDataProviders: [this.lwcDataProvider, this.auraDataProvider],
            useDefaultDataProvider: false,
        });

        this.context.configureProject();
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
                    triggerCharacters: ['{', '.', '-', '_', '<', '"', '=', '/', '>'],
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

    async onCompletion(params: TextDocumentPositionParams): Promise<CompletionList> {
        const {
            position,
            textDocument: { uri },
        } = params;
        const doc = this.documents.get(uri);
        const htmlDoc: HTMLDocument = this.languageService.parseHTMLDocument(doc);

        if (await this.context.isLWCTemplate(doc)) {
            this.auraDataProvider.activated = false; // provide completions for lwc components in an Aura template
            this.lwcDataProvider.activated = true;
        } else if (await this.context.isLWCJavascript(doc)) {
            const customTags = this.componentIndexer.customData.map(tag => {
                return {
                    label: tag.lwcTypingsName,
                    kind: CompletionItemKind.Folder,
                };
            });

            return {
                isIncomplete: false,
                items: customTags,
            };
        } else if (await this.context.isAuraMarkup(doc)) {
            this.auraDataProvider.activated = true;
            this.lwcDataProvider.activated = false;
        } else {
            return;
        }
        return this.languageService.doComplete(doc, position, htmlDoc);
    }

    onCompletionResolve(item: CompletionItem): CompletionItem {
        return item;
    }

    async onHover(params: TextDocumentPositionParams): Promise<Hover> {
        const {
            position,
            textDocument: { uri },
        } = params;
        const doc = this.documents.get(uri);
        const htmlDoc: HTMLDocument = this.languageService.parseHTMLDocument(doc);

        if (await this.context.isLWCTemplate(doc)) {
            this.auraDataProvider.activated = false;
            this.lwcDataProvider.activated = true;
        } else if (await this.context.isAuraMarkup(doc)) {
            this.auraDataProvider.activated = true;
            this.lwcDataProvider.activated = false;
        } else {
            return;
        }
        return this.languageService.doHover(doc, position, htmlDoc);
    }

    async onDidChangeContent(changeEvent: any): Promise<void> {
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
                if (tag) {
                    tag.updateMetadata(metadata);
                }
            }
        }
    }

    async onDidSave(change: TextDocumentChangeEvent): Promise<void> {
        const { document } = change;
        const { uri } = document;
        if (await this.context.isLWCJavascript(document)) {
            const doc = await javascriptCompileDocument(document);
            const metadata: Metadata = doc.metadata;
            if (metadata) {
                const tag = this.componentIndexer.findTagByURI(uri);
                if (tag) {
                    tag.updateMetadata(metadata);
                }
            }
        }
    }

    onShutdown(): void {
        this.componentIndexer.persistCustomComponents();
    }

    onExit(): void {
        this.componentIndexer.persistCustomComponents();
    }

    onDefinition(params: TextDocumentPositionParams): Location[] {
        const cursorInfo: CursorInfo = this.cursorInfo(params);

        if (!cursorInfo) {
            return null;
        }

        const tag = this.componentIndexer.findTagByName(cursorInfo.tag);

        switch (cursorInfo.type) {
            case Token.Tag:
                return tag?.allLocations || [];

            case Token.AttributeKey:
                const attr = tag?.attribute(cursorInfo.name);
                if (attr) {
                    return [attr.location];
                }

            case Token.DynamicContent:
            case Token.DynamicAttributeValue:
                const { uri } = params.textDocument;
                if (cursorInfo.range) {
                    return [Location.create(uri, cursorInfo.range)];
                } else {
                    const component: Tag = this.componentIndexer.findTagByURI(uri);
                    const location = component?.classMemberLocation(cursorInfo.name);
                    if (location) {
                        return [location];
                    }
                }
        }
        return [];
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
            if (token === TokenType.AttributeName) {
                attributeName = scanner.getTokenText();
                const iterator = iteratorRegex.exec(attributeName);
                if (iterator) {
                    iterators.unshift({
                        name: iterator.groups.name, // this does not account for same sibling iterators
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

    listen(): void {
        interceptConsoleLogger(this.connection);
        this.connection.listen();
    }
}
