'use strict';

import { HTMLDocument } from '../parser/htmlParser';
import { createScanner } from '../parser/htmlScanner';
import { TextDocument, Range, Position, Location } from 'vscode-languageserver-types';
import { getTagProviders } from './tagProviders';
import { TokenType } from '../htmlLanguageTypes';

const TOP_OF_FILE: Range = Range.create(Position.create(0, 0), Position.create(0, 0));

export function findDefinition(document: TextDocument, position: Position, htmlDocument: HTMLDocument): Location | null {
    const offset = document.offsetAt(position);
    const node = htmlDocument.findNodeAt(offset);
    if (!node || !node.tag) {
        return null;
    }
    const tagProviders = getTagProviders().filter(p => p.isApplicable(document.languageId));

    function getTagLocation(tag: string): Location | null {
        for (const provider of tagProviders) {
            const info = provider.getTagInfo(tag);
            if (info && info.location) {
                return info.location;
            }
        }
        return null;
    }

    function getAttributeLocation(tag: string, attribute: string): Location | null {
        for (const provider of tagProviders) {
            const tagInfo = provider.getTagInfo(tag);
            if (tagInfo) {
                const attrInfo = tagInfo.getAttributeInfo(attribute);
                if (attrInfo && attrInfo.location) {
                    return attrInfo.location;
                }
            }
        }
        return null;
    }

    function getTagNameRange(tokenType: TokenType, startOffset: number): Range | null {
        const scanner = createScanner(document.getText(), startOffset);
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
        const endTagRange = getTagNameRange(TokenType.EndTag, node.endTagStart);
        if (endTagRange) {
            return getTagLocation(node.tag);
        }
        return null;
    }

    const tagRange = getTagNameRange(TokenType.StartTag, node.start);
    if (tagRange) {
        return getTagLocation(node.tag);
    }

    const attributeRange = getTagNameRange(TokenType.AttributeName, node.start);
    if (attributeRange) {
        return getAttributeLocation(node.tag, document.getText(attributeRange));
    }

    return null;
}
