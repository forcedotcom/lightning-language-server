/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { HTMLDocument } from '../parser/htmlParser';
import { TokenType, createScanner } from '../parser/htmlScanner';
import { TextDocument, Range, Position, Hover, MarkedString } from 'vscode-languageserver-types';
import { allTagProviders } from './tagProviders';

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

    function getTagNameRange(tokenType: TokenType, startOffset: number): Range | null {
        const scanner = createScanner(document.getText(), startOffset);
        let token = scanner.scan();
        while (token !== TokenType.EOS && (scanner.getTokenEnd() < offset || scanner.getTokenEnd() === offset && token !== tokenType)) {
            token = scanner.scan();
        }
        if (token === tokenType && offset <= scanner.getTokenEnd()) {
            return { start: document.positionAt(scanner.getTokenOffset()), end: document.positionAt(scanner.getTokenEnd()) };
        }
        return null;
    }

    if (node.endTagStart && offset >= node.endTagStart) {
        const endTagRange = getTagNameRange(TokenType.EndTag, node.endTagStart);
        if (endTagRange) {
            return getTagHover(node.tag, endTagRange, false);
        }
        return null;
    }

    const tagRange = getTagNameRange(TokenType.StartTag, node.start);
    if (tagRange) {
        return getTagHover(node.tag, tagRange, true);
    }
    return null;
}
