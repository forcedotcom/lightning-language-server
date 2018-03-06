/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { HTMLDocument } from '../parser/htmlParser';
import { TokenType, createScanner } from '../parser/htmlScanner';
import { TextDocument, Range, Position, Hover, MarkedString } from 'vscode-languageserver-types';
import { allTagProviders } from './tagProviders';
import { getDirectiveInfo } from '../parser/lwcTags';

export interface ITokenInfo {
    range: Range;
    name?: string;
}

export function getTokenInfo(document: TextDocument, offset: number, tokenType: TokenType, startOffset: number): ITokenInfo | null {
    const scanner = createScanner(document.getText(), startOffset);
    let token = scanner.scan();
    while (token !== TokenType.EOS && (scanner.getTokenEnd() < offset || scanner.getTokenEnd() === offset && token !== tokenType)) {
        token = scanner.scan();
    }
    if (token === tokenType && offset <= scanner.getTokenEnd()) {
        const tokenInfo: ITokenInfo = { range: { start: document.positionAt(scanner.getTokenOffset()), end: document.positionAt(scanner.getTokenEnd()) } };
        if (tokenType === TokenType.AttributeName) {
            tokenInfo.name = scanner.getLastAttributeName();
        }
        return tokenInfo;
    }
    return null;
}

export function doHover(document: TextDocument, position: Position, htmlDocument: HTMLDocument): Hover| null {
    const offset = document.offsetAt(position);
    const node = htmlDocument.findNodeAt(offset);
    if (!node || !node.tag) {
        return null;
    }

    const tagProviders = allTagProviders.filter(p => p.isApplicable(document.languageId));

    function getTagHover(tag: string, range: Range, open: boolean): Hover | null {
        tag = tag.toLowerCase();
        for (const provider of tagProviders) {
            const info = provider.getTagInfo(tag);
            if (info && info.documentation) {
                const tagLabel = open ? '<' + tag + '>' : '</' + tag + '>';
                return { contents: [ { language: 'html', value: tagLabel }, MarkedString.fromPlainText(info.documentation)], range };
            }
        }
        return null;
    }

    function getAttributeHover(tag: string, tokenInfo: ITokenInfo): Hover | null {
        tag = tag.toLowerCase();
        const name = tokenInfo.name;
        const range = tokenInfo.range;
        for (const provider of tagProviders) {
            const tagInfo = provider.getTagInfo(tag);
            if (tagInfo) {
                const attrInfo = tagInfo.getAttributeInfo(name);
                if (attrInfo && attrInfo.documentation) {
                    return { contents: [ { language: 'html', value: name }, MarkedString.fromPlainText(attrInfo.documentation)], range };
                }
            }
        }
        const directiveInfo = getDirectiveInfo(name);
        if (directiveInfo) {
            return { contents: [ { language: 'html', value: name }, MarkedString.fromPlainText(directiveInfo.documentation)], range };
        }
        return null;
    }

    if (node.endTagStart && offset >= node.endTagStart) {
        const endTagInfo = getTokenInfo(document, offset, TokenType.EndTag, node.endTagStart);
        if (endTagInfo) {
            return getTagHover(node.tag, endTagInfo.range, false);
        }
        return null;
    }

    const startTagInfo = getTokenInfo(document, offset, TokenType.StartTag, node.start);
    if (startTagInfo) {
        return getTagHover(node.tag, startTagInfo.range, true);
    }

    const attributeInfo = getTokenInfo(document, offset, TokenType.AttributeName, node.start);
    if (attributeInfo) {
        return getAttributeHover(node.tag, attributeInfo);
    }

    return null;
}
