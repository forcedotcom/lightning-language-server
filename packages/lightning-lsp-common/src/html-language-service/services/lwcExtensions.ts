'use strict';

import { HTMLDocument, Node } from '../parser/htmlParser';
import { createScanner } from '../parser/htmlScanner';
import { TextDocument, Range, Position, Location } from 'vscode-languageserver-types';
import { TokenType } from '../htmlLanguageTypes';

const TOP_OF_FILE: Range = Range.create(Position.create(0, 0), Position.create(0, 0));



function stripQuotes(str: string) {
    if (str.charAt(0) === '"' && str.charAt(str.length - 1) === '"') {
        return str.substr(1, str.length - 2);
    }
    if (str.charAt(0) === "'" && str.charAt(str.length - 1) === "'") {
        return str.substr(1, str.length - 2);
    }
    return str;
}
function hasQuotes(str: string) {
    return (str.charAt(0) === '"' && str.charAt(str.length - 1) === '"') || (str.charAt(0) === "'" && str.charAt(str.length - 1) === "'");
}
function getTagNameRange(document: TextDocument, offset: number, tokenType: TokenType, startOffset: number): Range | null {
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

function getAttributeRange(document: TextDocument, attributeName: string, startOffset: number, endOffset: number): Range | null {
    const scanner = createScanner(document.getText(), startOffset);
    let token = scanner.scan();
    while (token !== TokenType.EOS && scanner.getTokenEnd() < endOffset) {
        if (token === TokenType.AttributeName) {
            const curAttributeName = document.getText({
                start: document.positionAt(scanner.getTokenOffset()),
                end: document.positionAt(scanner.getTokenEnd()),
            });
            if (curAttributeName === attributeName) {
                let token = scanner.scan();
                while (token !== TokenType.EOS) {
                    if (token === TokenType.AttributeValue) {
                        const range = { start: document.positionAt(scanner.getTokenOffset()), end: document.positionAt(scanner.getTokenEnd()) };
                        const value = document.getText(range);
                        if (hasQuotes(value)) {
                            range.start.character = range.start.character + 1;
                            range.end.character = range.end.character - 1;
                        }
                        return range;
                    }
                    token = scanner.scan();
                }
            }
        }
        token = scanner.scan();
        if (token === TokenType.StartTagClose || token == TokenType.StartTagSelfClose) {
            break;
        }
    }
    return null;
}
function getIteratorNameRange(document: TextDocument, attributeName: string, startOffset: number, endOffset: number): Range | null {
    const scanner = createScanner(document.getText(), startOffset);
    let token = scanner.scan();
    while (token !== TokenType.EOS && scanner.getTokenEnd() < endOffset) {
        if (token === TokenType.AttributeName) {
            const range = {
                start: document.positionAt(scanner.getTokenOffset()),
                end: document.positionAt(scanner.getTokenEnd()),
            };
            const curAttributeName = document.getText(range);
            if (curAttributeName === attributeName) {
                // we have a name range, lets adjust it to be after the 'iterator:' part
                range.start.character = range.start.character + 'iterator:'.length;
                return range;
            }
        }
        token = scanner.scan();
        if (token === TokenType.StartTagClose || token == TokenType.StartTagSelfClose) {
            break;
        }
    }
    return null;
}
function findDeclaration(document: TextDocument, attributeValue: string, node: Node): Location | null {
    let cur: Node = node;
        while (cur.parent != null) {
            const item = stripQuotes((cur.attributes && cur.attributes['for:item']) || '');
            if (item === attributeValue) {
                // matched to for:each definition
                const range = getAttributeRange(document, 'for:item', cur.start, cur.end);
                if (range) {
                    return {
                        uri: document.uri,
                        range,
                    };
                }
            }
            // try iterator: tag
            const attributeName = cur.attributeNames.find(a => a.startsWith('iterator:'));
            if (attributeName) {
                const split = attributeName.split(':');
                if (split.length == 2 && split[1] === attributeValue) {
                    const range = getIteratorNameRange(document, attributeName, cur.start, cur.end);
                    if (range) {
                        return {
                            uri: document.uri,
                            range,
                        };
                    }
                }
            }
            cur = cur.parent;
        }
    return null;
}

export function findAttributeDefinition(document: TextDocument, position: Position, htmlDocument: HTMLDocument): Location | null {
    const offset = document.offsetAt(position);
    const node = htmlDocument.findNodeAt(offset);
    if (!node || !node.tag) {
        return null;
    }
    let attributeValue = getAttributeValueProperty(document, position, htmlDocument);
    if (attributeValue == null) {
        // try looking through body text...
        const scanner = createScanner(document.getText(), node.start);
        let token = scanner.scan();
        while (token !== TokenType.EOS && scanner.getTokenEnd() <= node.end ) {
            if (token === TokenType.Content) {
                const range = {
                    start: document.positionAt(scanner.getTokenOffset()),
                    end: document.positionAt(scanner.getTokenEnd()),
                };
                const curContent = document.getText(range);
                const relativeOffset = offset - scanner.getTokenOffset();
                var match;
                const valuePattern = /{(\w*)(?:\.(.*?))?}/g;
                while(match = valuePattern.exec(curContent)){
                    const start = (valuePattern.lastIndex - match[0].length);
                    const end = (valuePattern.lastIndex-1);
                    if (( start <= relativeOffset) && (relativeOffset <= end) ) {
                        // this just gives us the match within the full regular expression match
                        // we want to make sure we're only on the left most property. 
                        const dotIndex = curContent.indexOf('.', start);
                        if (dotIndex == -1 || relativeOffset < dotIndex) {
                            const startNode = htmlDocument.findNodeAt(scanner.getTokenOffset());
                            const location = findDeclaration(document, match[1], startNode);
                            return location;
                        }
                    }
                }
            }
            token = scanner.scan();
        }
    }
    if (attributeValue) {
        return findDeclaration(document, attributeValue, node);
    }
    return null;
}

export function getAttributeValueProperty(document: TextDocument, position: Position, htmlDocument: HTMLDocument): string | null {
    const offset = document.offsetAt(position);
    const node = htmlDocument.findNodeAt(offset);
    if (!node || !node.tag) {
        return null;
    }

    const attributeRange = getTagNameRange(document, offset, TokenType.AttributeValue, node.start);
    if (attributeRange) {
        const value = document.getText(attributeRange);
        const valueRelativeOffset = offset - document.offsetAt(attributeRange.start);
        const dotIndex = value.indexOf('.');
        // make sure our position is BEFORE the first dot before matching...
        if (dotIndex!= -1 && valueRelativeOffset >= dotIndex) {
            // we're after the first dot, bail
            return null;
        }
        const valueTrimmed = value.trim();
        const valuePattern = /{(\w*)(?:\.(.*?))?}/g;
        const match = valuePattern.exec(valueTrimmed);
        if (match) {
            const property = match[1];
            return property;
        }
    }
    return null;
}
