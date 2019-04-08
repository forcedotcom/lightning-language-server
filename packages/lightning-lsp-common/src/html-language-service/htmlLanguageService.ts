/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { createScanner } from './parser/htmlScanner';
import { parse } from './parser/htmlParser';
import { HTMLCompletion } from './services/htmlCompletion';
import { IHTMLTagProvider } from './parser/htmlTags';
import { addTagProvider, getTagProviders } from './services/tagProviders';
import { doHover } from './services/htmlHover';
import { format } from './services/htmlFormatter';
import { findDocumentLinks } from './services/htmlLinks';
import { findDocumentHighlights } from './services/htmlHighlighting';
import { findDocumentSymbols } from './services/htmlSymbolsProvider';
import { findDefinition } from './services/htmlDefinition';
import { getPropertyBindingTemplateDeclaration, getPropertyBindingValue } from './services/lwcExtensions';
import { getAuraBindingTemplateDeclaration, getAuraBindingValue } from './services/auraExtensions';
import {
    TextDocument,
    Position,
    CompletionList,
    Hover,
    Range,
    SymbolInformation,
    TextEdit,
    DocumentHighlight,
    DocumentLink,
    FoldingRange,
} from 'vscode-languageserver-types';
import { Scanner, HTMLDocument, CompletionConfiguration, ICompletionParticipant, HTMLFormatConfiguration, DocumentContext } from './htmlLanguageTypes';
import { getFoldingRanges } from './services/htmlFolding';
import { Location } from 'vscode-languageserver-types';

export * from './htmlLanguageTypes';
export * from 'vscode-languageserver-types';

export interface LanguageService {
    addTagProvider(provider: IHTMLTagProvider): void;
    getTagProviders(): IHTMLTagProvider[];
    createScanner(input: string, initialOffset?: number): Scanner;
    parseHTMLDocument(document: TextDocument): HTMLDocument;
    findDocumentHighlights(document: TextDocument, position: Position, htmlDocument: HTMLDocument): DocumentHighlight[];
    doComplete(document: TextDocument, position: Position, htmlDocument: HTMLDocument, options?: CompletionConfiguration): CompletionList;
    setCompletionParticipants(registeredCompletionParticipants: ICompletionParticipant[]): void;
    doHover(document: TextDocument, position: Position, htmlDocument: HTMLDocument): Hover | null;
    format(document: TextDocument, range: Range | undefined, options: HTMLFormatConfiguration): TextEdit[];
    findDocumentLinks(document: TextDocument, documentContext: DocumentContext): DocumentLink[];
    findDocumentSymbols(document: TextDocument, htmlDocument: HTMLDocument): SymbolInformation[];
    doTagComplete(document: TextDocument, position: Position, htmlDocument: HTMLDocument): string | null;
    getFoldingRanges(document: TextDocument, context?: { rangeLimit?: number }): FoldingRange[];
    // TODO HACK - adding findDefinition here to make LWC work for now
    findDefinition(document: TextDocument, position: Position, htmlDocument: HTMLDocument): Location | null;
    getPropertyBindingTemplateDeclaration(document: TextDocument, position: Position, htmlDocument: HTMLDocument): Location | null;
    getPropertyBindingValue(document: TextDocument, position: Position, htmlDocument: HTMLDocument): string | null;
    getAuraBindingTemplateDeclaration(document: TextDocument, position: Position, htmlDocument: HTMLDocument): Location | null;
    getAuraBindingValue(document: TextDocument, position: Position, htmlDocument: HTMLDocument): string | null;
}

export function getLanguageService(): LanguageService {
    const htmlCompletion = new HTMLCompletion();
    return {
        createScanner,
        addTagProvider,
        getTagProviders,
        parseHTMLDocument: document => parse(document.getText()),
        doComplete: htmlCompletion.doComplete.bind(htmlCompletion),
        setCompletionParticipants: htmlCompletion.setCompletionParticipants.bind(htmlCompletion),
        doHover,
        format,
        findDocumentHighlights,
        findDocumentLinks,
        findDocumentSymbols,
        getFoldingRanges,
        doTagComplete: htmlCompletion.doTagComplete.bind(htmlCompletion),
        findDefinition,
        getPropertyBindingTemplateDeclaration,
        getPropertyBindingValue,
        getAuraBindingTemplateDeclaration,
        getAuraBindingValue,
    };
}
