/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { HTMLDocument } from '../parser/htmlParser';
import { createScanner } from '../parser/htmlScanner';
import { TextDocument, Range, Position, Hover, MarkedString, MarkupKind } from 'vscode-languageserver-types';
import { getTagProviders } from './tagProviders';
import { TokenType } from '../htmlLanguageTypes';
import { AttributeInfo } from '../../indexer/attributeInfo';

export function doHover(document: TextDocument, position: Position, htmlDocument: HTMLDocument): Hover | null {
    let offset = document.offsetAt(position);
    let node = htmlDocument.findNodeAt(offset);
    if (!node || !node.tag) {
        return null;
    }
    let tagProviders = getTagProviders().filter(p => p.isApplicable(document.languageId));
    function getTagHover(tag: string, range: Range, open: boolean): Hover | null {
        // **** CHANGES TO HTML LANGUAGE SERVICE HERE **** //
        //tag = tag.toLowerCase();
        for (let provider of tagProviders) {
            let hover = null;
            const tagInfo = provider.getTagInfo(tag);
            if (tagInfo) {
                const doc = tagInfo.getHover();
                const tagLabel = open ? '<' + tag + '>' : '</' + tag + '>';
                const markdown = ['```html', tagLabel, '```', doc];
                return { contents: { kind: MarkupKind.Markdown, value: markdown.join('\n') }, range };
            }
        }
        return null;
    }

    function getAttributeHover(tag: string, name: string, range: Range): Hover | null {
        tag = tag.toLowerCase();
        for (const provider of tagProviders) {
            const tagInfo = provider.getTagInfo(tag);
            if (tagInfo) {
                const attrInfo = tagInfo.getAttributeInfo(name);
                if (attrInfo) {
                    const markdown = ['**' + name + '**', '', attrInfo.documentation || ''];
                    return { contents: { kind: MarkupKind.Markdown, value: markdown.join('\n') }, range };
                }
            }
            // If we don't match on tags / attributes, see if we match any directives
            const directiveInfo = getAttributeInfo(name, provider.getGlobalAttributes());
            if (directiveInfo) {
                const markdown = ['**' + name + '**', '', directiveInfo.documentation];
                return { contents: { kind: MarkupKind.Markdown, value: markdown.join('\n') }, range };
            }
        }

        return null;
    }

    // Ugh, dumb
    function getAttributeInfo(label: string, globalAttributes: AttributeInfo[]): AttributeInfo | null {
        for (const info of globalAttributes) {
            if (label === info.name) {
                return info;
            }
        }
        return null;
    }

    function getTagNameRange(tokenType: TokenType, startOffset: number): Range | null {
        let scanner = createScanner(document.getText(), startOffset);
        let token = scanner.scan();
        while (token !== TokenType.EOS && (scanner.getTokenEnd() < offset || (scanner.getTokenEnd() === offset && token !== tokenType))) {
            token = scanner.scan();
        }
        if (token === tokenType && offset <= scanner.getTokenEnd()) {
            return { start: document.positionAt(scanner.getTokenOffset()), end: document.positionAt(scanner.getTokenEnd()) };
        }
        return null;
    }

    if (node.endTagStart && offset >= node.endTagStart) {
        let tagRange = getTagNameRange(TokenType.EndTag, node.endTagStart);
        if (tagRange) {
            return getTagHover(node.tag, tagRange, false);
        }
        return null;
    }

    let tagRange = getTagNameRange(TokenType.StartTag, node.start);
    if (tagRange) {
        return getTagHover(node.tag, tagRange, true);
    }

    const attributeRange = getTagNameRange(TokenType.AttributeName, node.start);
    if (attributeRange) {
        return getAttributeHover(node.tag, document.getText(attributeRange), attributeRange);
    }

    return null;
}
