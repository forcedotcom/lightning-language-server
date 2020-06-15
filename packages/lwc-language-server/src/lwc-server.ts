import {
    createConnection,
    IConnection,
    TextDocuments,
    WorkspaceFolder,
    InitializeParams,
    InitializeResult,
    // TextDocumentPositionParams,
    // DidChangeWatchedFilesParams,
} from 'vscode-languageserver';

import { getLanguageService, LanguageService, IHTMLDataProvider } from 'vscode-html-languageservice';
import { interceptConsoleLogger } from '@salesforce/lightning-lsp-common';
import ComponentIndexer from './component-indexer';
import TypingIndexer from './typing-indexer';
import { LWCDataProvider } from './lwc-data-provider';

import * as path from 'path';
import URI from 'vscode-uri';

export default class Server {
    public connection: IConnection;
    public workspaceFolders: WorkspaceFolder[];
    public workspaceRoots: string[];

    readonly documents: TextDocuments;
    readonly languageService: LanguageService;
    readonly dataProvider: IHTMLDataProvider;
    readonly componentIndexer: ComponentIndexer;
    readonly typingIndexer: TypingIndexer;

    constructor() {
        this.documents = new TextDocuments();
        // this.dataProvider = new LWCDataProvider();
        // this.languageService = getLanguageService({
        //     customDataProviders: [this.dataProvider],
        // });
    }

    public init(params: InitializeParams): void {
        this.connection = createConnection();
        this.documents.listen(this.connection);
        interceptConsoleLogger(this.connection);

        this.workspaceFolders = params.workspaceFolders;
        this.workspaceRoots = this.workspaceFolders.map(folder => {
            return path.resolve(URI.parse(folder.uri).fsPath);
        });
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
}

// import {
//    Location,
//    TextDocument,
//    TextDocumentPositionParams,
// } from 'vscode-languageserver';

// import {
//    HTMLDocument,
// } from 'vscode-html-languageservice';

// export default class Definition {

//    public static find(params: TextDocumentPositionParams, document: HTMLDocument): Location {
//        //If node, find in LWC
//        const tagDefinition = findDefinition(document, textDocumentPosition.position, htmlDocument);
//        if (tagDefinition)  return tagDefinition

//        const attrDefintion = htmlLS.getPropertyBindingTemplateDeclaration(document, textDocumentPosition.position, htmlDocument);
//        if (attrDefinition)  return attrDefintion

//        const valueProperty = htmlLS.getPropertyBindingValue(document, textDocumentPosition.position, htmlDocument);
//        if (valueProperty) {
//          const jsProperty = findJavascriptProperty(valueProperty, textDocumentPosition);
//          if(jsProperty) return jsProperty
//        }

//    }
// }

// import { createScanner } from '../parser/htmlScanner';
// import { TextDocument, Range, Position, Location } from 'vscode-languageserver-types';
// import { getTagProviders } from './tagProviders';
// import { TokenType } from '../htmlLanguageTypes';

// const TOP_OF_FILE: Range = Range.create(Position.create(0, 0), Position.create(0, 0));

// export function findDefinition(document: TextDocument, position: Position, htmlDocument: HTMLDocument): Location | null {
//    const offset = document.offsetAt(position);
//    const node = htmlDocument.findNodeAt(offset);
//    if (!node || !node.tag) {
//        return null;
//    }
//    const tagProviders = getTagProviders().filter(p => p.isApplicable(document.languageId));

//    //if clicked on tag element, not anyhting within it
//    if (node.endTagStart && offset >= node.endTagStart) {
//        const endTagRange = getTagNameRange(TokenType.EndTag, node.endTagStart);
//        if (endTagRange) {
//            return getTagLocation(node.tag);
//        }
//        return null;
//    }

//    const tagRange = getTagNameRange(TokenType.StartTag, node.start);
//    if (tagRange) {
//        return getTagLocation(node.tag);
//    }

//    const attributeRange = getTagNameRange(TokenType.AttributeName, node.start);
//    if (attributeRange) {
//        return getAttributeLocation(node.tag, document.getText(attributeRange));
//    }

//    return null;
// }

// function getTagLocation(tag: string): Location | null {
//    for (const provider of tagProviders) {
//        const info = provider.getTagInfo(tag);
//        if (info && info.location) {
//            return info.location;
//        }
//    }
//    return null;
// }

// function getAttributeLocation(tag: string, attribute: string): Location | null {
//    for (const provider of tagProviders) {
//        const tagInfo = provider.getTagInfo(tag);
//        if (tagInfo) {
//            const attrInfo = tagInfo.getAttributeInfo(attribute);
//            if (attrInfo && attrInfo.location) {
//                return attrInfo.location;
//            }
//        }
//    }
//    return null;
// }

// function getTagNameRange(tokenType: TokenType, startOffset: number): Range | null {
//    const scanner = createScanner(document.getText(), startOffset);
//    let token = scanner.scan();
//    while (token !== TokenType.EOS && (scanner.getTokenEnd() < offset || (scanner.getTokenEnd() === offset && token !== tokenType))) {
//        token = scanner.scan();
//    }
//    if (token === tokenType && offset <= scanner.getTokenEnd()) {
//        return { start: document.positionAt(scanner.getTokenOffset()), end: document.positionAt(scanner.getTokenEnd()) };
//    }
//    return null;
// }
