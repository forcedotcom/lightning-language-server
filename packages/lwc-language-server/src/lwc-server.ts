import {
    createConnection,
    IConnection,
    TextDocuments,
    TextDocument,
    Location,
    WorkspaceFolder,
    InitializeResult,
    InitializeParams,
    TextDocumentPositionParams,
} from 'vscode-languageserver';

import { getLanguageService, LanguageService, IHTMLDataProvider, CompletionList } from 'vscode-html-languageservice';
import ComponentIndexer from './component-indexer';
import TypingIndexer from './typing-indexer';
import { LWCDataProvider } from './lwc-data-provider';

import URI from 'vscode-uri';
import { WorkspaceContext } from '@salesforce/lightning-lsp-common';

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
        this.documents.listen(this.connection);
        this.connection.onInitialize(this.onInitialize.bind(this));
        this.connection.onCompletion(this.onCompletion.bind(this));
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

    capabilities(): InitializeResult {
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

    listen() {
        this.connection.listen();
    }
}
