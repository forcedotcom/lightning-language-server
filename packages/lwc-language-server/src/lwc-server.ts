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

import { getLanguageService, LanguageService, IHTMLDataProvider, HTMLDocument } from 'vscode-html-languageservice';
import { findDefinition } from '@salesforce/lightning-lsp-common/lib/html-language-service/services/HTMLDefinition';
import { getPropertyBindingTemplateDeclaration } from '@salesforce/lightning-lsp-common/lib/html-language-service/services/lwcExtensions';
import { getPropertyBindingValue } from '@salesforce/lightning-lsp-common/lib/html-language-service/services/lwcExtensions';
import ComponentIndexer from './component-indexer';
import TypingIndexer from './typing-indexer';
import { LWCDataProvider } from './lwc-data-provider';

import * as path from 'path';
import URI from 'vscode-uri';
import { create } from 'domain';

export default class Server {
    readonly connection: IConnection = createConnection();
    readonly documents: TextDocuments = new TextDocuments();

    workspaceFolders: WorkspaceFolder[];
    workspaceRoots: string[];
    dataProvider: IHTMLDataProvider;
    componentIndexer: ComponentIndexer;
    typingIndexer: TypingIndexer;
    languageService: LanguageService;

    constructor() {
        this.documents.listen(this.connection);
        this.connection.onInitialize(this.onInitialize.bind(this));
    }

    onInitialize(params: InitializeParams) {
        this.workspaceFolders = params.workspaceFolders;
        this.workspaceRoots = this.workspaceFolders.map(folder => folder.uri);
        this.componentIndexer = new ComponentIndexer({ workspaceRoot: this.workspaceRoots[0] });
        this.dataProvider = new LWCDataProvider({ indexer: this.componentIndexer });
        this.typingIndexer = new TypingIndexer({ workspaceRoot: this.workspaceRoots[0] });
        this.languageService = getLanguageService({
            customDataProviders: [this.dataProvider],
        });

        this.componentIndexer.init();
        this.typingIndexer.createNewMetaTypings();
        this.typingIndexer.deleteStaleMetaTypings();
        this.typingIndexer.saveCustomLabelTypings();

        return this.capabilities;
    }

    capabilities(documents: TextDocuments): InitializeResult {
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
    }

    // offsetOnElementTag(params: any): boolean {
    //     const { offset, htmlDoc, document, node } = params;
    //     const element = htmlDoc.findNodeAt(offset);
    //     return node.endTagStart && offset >= node.endTagStart;
    // }

    // definitionQuery(params: TextDocumentPositionParams, document: TextDocument): Location | void {
    //     const htmlDoc: HTMLDocument = this.languageService.parseHTMLDocument(document)
    //     const offset = document.offsetAt(params.position);
    //     const node = htmlDoc.findNodeAt(offset);
    //     const tagName = node.tag;
    //     const params = {
    //         offset,
    //         htmlDoc,
    //         document
    //     }

    //     if(offsetOnElementTag(params)) {

    //     }
    //     if(offsetOnElementAttribute(params)) {

    //     }
    //     if(offsetOnPropertyBinding(params)) {

    //     }
    //     if(offsetOnProperty(params)) {

    //     }
    // }
}
