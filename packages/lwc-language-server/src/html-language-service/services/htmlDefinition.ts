'use strict';

import { HTMLDocument } from '../parser/htmlParser';
import { TokenType, createScanner } from '../parser/htmlScanner';
import { TextDocument, Range, Position, Location } from 'vscode-languageserver-types';
import { allTagProviders } from './tagProviders';

const TOP_OF_FILE: Range = Range.create(Position.create(0, 0), Position.create(0, 0));

export function findDefinition(document: TextDocument, position: Position, htmlDocument: HTMLDocument): Location | null {
    const offset = document.offsetAt(position);
    const node = htmlDocument.findNodeAt(offset);
    if (!node || !node.tag) {
        return null;
    }
    const tagProviders = allTagProviders.filter(p => p.isApplicable(document.languageId));
    function getTagLocation(tag: string): Location | null {
        tag = tag.toLowerCase();
        for (const provider of tagProviders) {
            let location = null;
            provider.collectTags((t, info) => {
                if (t === tag  && info.definitionUri) {
                    location = Location.create(info.definitionUri, TOP_OF_FILE);
                }
            });
            if (location) {
                return location;
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
            return getTagLocation(node.tag);
        }
        return null;
    }

    const tagRange = getTagNameRange(TokenType.StartTag, node.start);
    if (tagRange) {
        return getTagLocation(node.tag);
    }
    return null;
}
