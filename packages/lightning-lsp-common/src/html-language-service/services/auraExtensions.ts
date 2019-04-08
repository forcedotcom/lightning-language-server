'use strict';

import { HTMLDocument, Node } from '../parser/htmlParser';
import { createScanner } from '../parser/htmlScanner';
import { TextDocument, Range, Position, Location } from 'vscode-languageserver-types';
import { TokenType } from '../htmlLanguageTypes';
import { getTagNameRange, stripQuotes, getAttributeRange } from './utils';

const TOP_OF_FILE: Range = Range.create(Position.create(0, 0), Position.create(0, 0));

function findAuraDeclaration(document: TextDocument, attributeValue: string, htmlDocument: HTMLDocument): Location | null {
    for (const root of htmlDocument.roots) {
        const attributes = root.children.filter(n => n.tag === 'aura:attribute');
        for (const attribute of attributes) {
            const attrs = attribute.attributes || {};
            if (stripQuotes(attrs.name) === attributeValue) {
                const range = getAttributeRange(document, 'name', attribute.start, attribute.end);
                if (range) {
                    return {
                        uri: document.uri,
                        range,
                    };
                }
            }
        }
    }
    return null;
}

/**
 * Looks for property bindings {PROPERTY.something} within attribute values, or body content, and returns a location
 * within the same template that corresponds to iterator:PROPERTY or for:item="PROPERTY".
 */
export function getAuraBindingTemplateDeclaration(document: TextDocument, position: Position, htmlDocument: HTMLDocument): Location | null {
    const offset = document.offsetAt(position);
    const node = htmlDocument.findNodeAt(offset);
    if (!node || !node.tag) {
        return null;
    }
    let propertyValue = getAuraBindingValue(document, position, htmlDocument);
    if (propertyValue) {
        return findAuraDeclaration(document, propertyValue, htmlDocument);
    }
    return null;
}
/**
 * Parses attribute value or body text content looking for the active {PROPERTY.something} reference corresponding
 * to the position. It will only return the leading property name. i.e. PROPERTY
 */
export function getAuraBindingValue(document: TextDocument, position: Position, htmlDocument: HTMLDocument): string | null {
    const offset = document.offsetAt(position);
    const node = htmlDocument.findNodeAt(offset);
    if (!node || !node.tag) {
        return null;
    }

    // first look through attribute values
    const attributeRange = getTagNameRange(document, offset, TokenType.AttributeValue, node.start);
    if (attributeRange) {
        const value = document.getText(attributeRange);
        const valueRelativeOffset = offset - document.offsetAt(attributeRange.start);
        const dotIndex = value.indexOf('.');
        // make sure our position is AFTER the first dot before matching...
        if (dotIndex != -1 && valueRelativeOffset < dotIndex) {
            // we're after the first dot, bail
            return null;
        }
        const valueTrimmed = value.trim();
        const valuePattern = /['"]?\s*{[!#]\s*[!]?[vmc]\.(\w*)(\.?\w*)*\s*}\s*['"]?/g;
        const match = valuePattern.exec(valueTrimmed);
        if (match) {
            const property = match[1];
            return property;
        }
    }
    // try looking through body text...
    if (!attributeRange) {
        const scanner = createScanner(document.getText(), node.start);
        let token = scanner.scan();
        while (token !== TokenType.EOS && scanner.getTokenEnd() <= node.end) {
            if (token === TokenType.Content) {
                const range = {
                    start: document.positionAt(scanner.getTokenOffset()),
                    end: document.positionAt(scanner.getTokenEnd()),
                };
                const curContent = document.getText(range);
                const relativeOffset = offset - scanner.getTokenOffset();
                var match;
                const valuePattern = /['"]?\s*{[!#]\s*[!]?[vmc]\.(\w*)(\.?\w*)*\s*}\s*['"]?/g;
                while ((match = valuePattern.exec(curContent))) {
                    const start = valuePattern.lastIndex - match[0].length;
                    const end = valuePattern.lastIndex - 1;
                    if (start <= relativeOffset && relativeOffset <= end) {
                        // this just gives us the match within the full regular expression match
                        // we want to make sure we're only on the left most property following
                        // the m, c, v character.
                        const dotIndex = curContent.indexOf('.', start);
                        if (dotIndex != -1) {
                            const nextDotIndex = curContent.indexOf('.', dotIndex + 1);
                            if (nextDotIndex != -1) {
                                if (relativeOffset > dotIndex && relativeOffset < nextDotIndex) {
                                    return match[1];
                                }
                            } else {
                                if (relativeOffset > dotIndex) {
                                    return match[1];
                                }
                            }
                        } else {
                            return match[1];
                        }
                        if (dotIndex == -1) {
                            return match[1];
                        }
                    }
                }
            }
            token = scanner.scan();
        }
    }
    return null;
}
