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
    CompletionParams,
    DidChangeWatchedFilesParams,
    ShowMessageNotification,
    MessageType,
    FileChangeType,
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

import { basename, dirname, parse } from 'path';

import { compileDocument as javascriptCompileDocument } from './javascript/compiler';
import { AuraDataProvider } from './aura-data-provider';
import { LWCDataProvider } from './lwc-data-provider';
import { WorkspaceContext, interceptConsoleLogger, utils, shared } from '@salesforce/lightning-lsp-common';

import ComponentIndexer from './component-indexer';
import TypingIndexer from './typing-indexer';
import templateLinter from './template/linter';
import Tag from './tag';
import TSConfigPathIndexer from './typescript/tsconfig-path-indexer';
import { URI } from 'vscode-uri';
import { TYPESCRIPT_SUPPORT_SETTING } from './constants';
import { isLWCWatchedDirectory } from '@salesforce/lightning-lsp-common/lib/utils';

export const propertyRegex = new RegExp(/\{(?<property>\w+)\.*.*\}/);
export const iteratorRegex = new RegExp(/iterator:(?<name>\w+)/);

const { WorkspaceType } = shared;

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
    tsconfigPathIndexer: TSConfigPathIndexer;

    constructor() {
        this.connection.onInitialize(this.onInitialize.bind(this));
        this.connection.onInitialized(this.onInitialized.bind(this));
        this.connection.onCompletion(this.onCompletion.bind(this));
        this.connection.onCompletionResolve(this.onCompletionResolve.bind(this));
        this.connection.onHover(this.onHover.bind(this));
        this.connection.onShutdown(this.onShutdown.bind(this));
        this.connection.onDefinition(this.onDefinition.bind(this));
        this.connection.onInitialized(this.onInitialized.bind(this));
        this.connection.onDidChangeWatchedFiles(this.onDidChangeWatchedFiles.bind(this));

        this.documents.listen(this.connection);
        this.documents.onDidChangeContent(this.onDidChangeContent.bind(this));
        this.documents.onDidSave(this.onDidSave.bind(this));
    }

    async onInitialize(params: InitializeParams): Promise<InitializeResult> {
        this.workspaceFolders = params.workspaceFolders;
        this.workspaceRoots = this.workspaceFolders.map((folder) => URI.parse(folder.uri).fsPath);
        this.context = new WorkspaceContext(this.workspaceRoots);
        this.componentIndexer = new ComponentIndexer({ workspaceRoot: this.workspaceRoots[0] });
        this.lwcDataProvider = new LWCDataProvider({ indexer: this.componentIndexer });
        this.auraDataProvider = new AuraDataProvider({ indexer: this.componentIndexer });
        this.typingIndexer = new TypingIndexer({ workspaceRoot: this.workspaceRoots[0] });
        // For maintaining tsconfig.json file paths on core workspace
        this.tsconfigPathIndexer = new TSConfigPathIndexer(this.workspaceRoots);
        this.languageService = getLanguageService({
            customDataProviders: [this.lwcDataProvider, this.auraDataProvider],
            useDefaultDataProvider: false,
        });

        await this.context.configureProject();
        await this.componentIndexer.init();
        this.typingIndexer.init();
        await this.tsconfigPathIndexer.init();

        return this.capabilities;
    }

    get capabilities(): InitializeResult {
        return {
            capabilities: {
                textDocumentSync: this.documents.syncKind,
                completionProvider: {
                    resolveProvider: true,
                    triggerCharacters: ['.', '-', '_', '<', '"', '=', '/', '>', '{'],
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

    async onInitialized(): Promise<void> {
        const hasTsEnabled = await this.isTsSupportEnabled();
        if (hasTsEnabled) {
            await this.context.configureProjectForTs();
            this.componentIndexer.updateSfdxTsConfigPath();
        }
    }

    private async isTsSupportEnabled(): Promise<any> {
        return this.connection.workspace.getConfiguration(TYPESCRIPT_SUPPORT_SETTING);
    }

    async onCompletion(params: CompletionParams): Promise<CompletionList> {
        const {
            position,
            textDocument: { uri },
        } = params;
        const doc = this.documents.get(uri);
        const htmlDoc: HTMLDocument = this.languageService.parseHTMLDocument(doc);

        if (await this.context.isLWCTemplate(doc)) {
            this.auraDataProvider.activated = false; // provide completions for lwc components in an Aura template
            this.lwcDataProvider.activated = true;
            if (this.shouldProvideBindingsInHTML(params)) {
                const docBasename = utils.getBasename(doc);
                const customTags: CompletionItem[] = this.findBindItems(docBasename);
                return {
                    isIncomplete: false,
                    items: customTags,
                };
            }
        } else if (await this.context.isLWCJavascript(doc)) {
            if (this.shouldCompleteJavascript(params)) {
                const customTags = this.componentIndexer.customData.map((tag) => {
                    return {
                        label: tag.lwcTypingsName,
                        kind: CompletionItemKind.Folder,
                    };
                });

                return {
                    isIncomplete: false,
                    items: customTags,
                };
            } else {
                return;
            }
        } else if (await this.context.isAuraMarkup(doc)) {
            this.auraDataProvider.activated = true;
            this.lwcDataProvider.activated = false;
        } else {
            return;
        }
        return this.languageService.doComplete(doc, position, htmlDoc);
    }

    private shouldProvideBindingsInHTML(params: CompletionParams): boolean {
        return params.context?.triggerCharacter === '{' || this.isWithinCurlyBraces(params);
    }

    private isWithinCurlyBraces(params: CompletionParams): boolean {
        const position = params.position;
        const doc = this.documents.get(params.textDocument.uri);
        const offset = doc.offsetAt(position);
        const text = doc.getText();
        let startIndex = offset - 1;
        let char = text.charAt(startIndex);
        const regPattern = /(\w|\$)/; // Valid variable names in JavaScript can contain letters, digits, underscore or $
        while (char.match(regPattern)) {
            startIndex -= 1;
            char = text.charAt(startIndex);
        }
        return char === '{';
    }

    private shouldCompleteJavascript(params: CompletionParams): boolean {
        return params.context?.triggerCharacter !== '{';
    }

    private findBindItems(docBasename: string): CompletionItem[] {
        const customTags: CompletionItem[] = [];
        this.componentIndexer.customData.forEach((tag) => {
            if (tag.name === docBasename) {
                tag.classMembers.forEach((cm) => {
                    const bindName = `${tag.name}.${cm.name}`;
                    const kind = cm.type === 'method' ? CompletionItemKind.Function : CompletionItemKind.Property;
                    const detail = cm.decorator ? `@${cm.decorator}` : '';
                    customTags.push({ label: cm.name, kind, documentation: bindName, detail, sortText: bindName });
                });
            }
        });
        return customTags;
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

    // TODO: Once the LWC custom module resolution plugin has been developed in the language server
    // this can be removed.
    async onDidChangeWatchedFiles(changeEvent: DidChangeWatchedFilesParams): Promise<void> {
        if (this.context.type === WorkspaceType.SFDX) {
            try {
                const hasTsEnabled = await this.isTsSupportEnabled();
                if (hasTsEnabled) {
                    const { changes } = changeEvent;
                    if (utils.isLWCRootDirectoryCreated(this.context, changes)) {
                        // LWC directory created
                        this.context.updateNamespaceRootTypeCache();
                        this.componentIndexer.updateSfdxTsConfigPath();
                    } else {
                        const hasDeleteEvent = await utils.containsDeletedLwcWatchedDirectory(this.context, changes);
                        if (hasDeleteEvent) {
                            // We need to scan the file system for deletion events as the change event does not include
                            // information about the files that were deleted.
                            this.componentIndexer.updateSfdxTsConfigPath();
                        } else {
                            const filePaths = [];
                            for (const event of changes) {
                                const insideLwcWatchedDirectory = await isLWCWatchedDirectory(this.context, event.uri);
                                if (event.type === FileChangeType.Created && insideLwcWatchedDirectory) {
                                    // File creation
                                    const filePath = utils.toResolvedPath(event.uri);
                                    const { dir, name: fileName, ext } = parse(filePath);
                                    const folderName = basename(dir);
                                    const parentFolder = basename(dirname(dir));
                                    // Only update path mapping for newly created lwc modules
                                    if (/.*(.ts|.js)$/.test(ext) && folderName === fileName && parentFolder === 'lwc') {
                                        filePaths.push(filePath);
                                    }
                                }
                            }
                            if (filePaths.length) {
                                this.componentIndexer.insertSfdxTsConfigPath(filePaths);
                            }
                        }
                    }
                }
            } catch (e) {
                this.connection.sendNotification(ShowMessageNotification.type, {
                    type: MessageType.Error,
                    message: `Error updating tsconfig.sfdx.json path mapping: ${e.message}`,
                });
            }
        }
    }

    async onDidSave(change: TextDocumentChangeEvent): Promise<void> {
        const { document } = change;
        if (await this.context.isLWCJavascript(document)) {
            const { metadata } = await javascriptCompileDocument(document);
            if (metadata) {
                const tag: Tag = this.componentIndexer.findTagByURI(document.uri);
                if (tag) {
                    tag.updateMetadata(metadata);
                }
            }
        } else if (await this.context.isLWCTypeScript(document)) {
            // update tsconfig.json file paths when a TS file is saved
            await this.tsconfigPathIndexer.updateTSConfigFileForDocument(document);
        }
    }

    onShutdown(): void {
        // Persist custom components for faster startup on next session
        this.componentIndexer.persistCustomComponents();

        this.connection.sendNotification(ShowMessageNotification.type, {
            type: MessageType.Info,
            message: 'LWC Language Server shutting down',
        });
    }

    onExit(): void {
        // Persist custom components for faster startup on next session
        this.componentIndexer.persistCustomComponents();

        this.connection.sendNotification(ShowMessageNotification.type, {
            type: MessageType.Info,
            message: 'LWC Language Server exiting',
        });
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
                    const item = iterators.find((i) => i.name === match.groups.property) || null;
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
                    const item = iterators.find((i) => i.name === match) ?? null;

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
