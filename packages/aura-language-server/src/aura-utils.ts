import { Range, TextDocument } from 'vscode-languageserver';
import { utils } from '@salesforce/lightning-lsp-common';
import { HTMLDocument, TokenType, getLanguageService } from 'vscode-html-languageservice';
import { join } from 'path';
import { createScanner } from 'vscode-html-languageservice/lib/umd/parser/htmlScanner';
import { Position, Location } from 'vscode-languageserver-types';

const AURA_STANDARD = 'aura-standard.json';
const AURA_SYSTEM = 'transformed-aura-system.json';
const AURA_EXTENSIONS: string[] = ['.cmp', '.app', '.design', '.evt', '.intf', '.auradoc', '.tokens'];

const RESOURCES_DIR = 'resources';

/**
 * Regex pattern to match Aura expression syntax in HTML templates.
 *
 * This pattern identifies Aura expressions that follow the format:
 * - {!v.property} - View/Component properties
 * - {!m.data} - Model data
 * - {!c.method} - Controller methods/properties
 * - {!#v.booleanValue} - Boolean expressions
 * - {!!v.negatedValue} - Negated expressions
 *
 * Pattern breakdown:
 * - ['"]? - Optional quotes at start/end
 * - \s* - Optional whitespace
 * - { - Opening brace
 * - [!#] - Either ! or # (expression operators)
 * - \s* - Optional whitespace
 * - [!]? - Optional ! (negation)
 * - [vmc] - One of v, m, or c (expression types)
 * - \. - Literal dot
 * - (\w*) - One or more word characters (first part)
 * - (\.?\w*)* - Zero or more optional dots + word characters
 * - \s* - Optional whitespace
 * - } - Closing brace
 *
 * Examples matched:
 * - {!v.account.Name}
 * - {!m.data.value}
 * - {!c.controllerMethod}
 * - {!#v.booleanValue}
 * - {!!v.negatedValue}
 * - "{!v.property}"
 * - '{!v.property}'
 */
const AURA_EXPRESSION_REGEX = /['"]?\s*{[!#]\s*[!]?[vmc]\.(\w*)(\.?\w*)*\s*}\s*['"]?/;

export function isAuraMarkup(textDocument: TextDocument): boolean {
    const fileExt = utils.getExtension(textDocument);
    return AURA_EXTENSIONS.includes(fileExt);
}

export function getAuraStandardResourcePath(): string {
    return join(__dirname, RESOURCES_DIR, AURA_STANDARD);
}

export function getAuraSystemResourcePath(): string {
    return join(__dirname, RESOURCES_DIR, AURA_SYSTEM);
}

// Create a parse function that works with the new API
export function parse(input: string): HTMLDocument {
    const languageService = getLanguageService();
    const mockDocument = TextDocument.create('file:///mock.html', 'html', 0, input);
    return languageService.parseHTMLDocument(mockDocument);
}


export function stripQuotes(str: string | null) {
    if (!str) {
        return str;
    }
    if (str.charAt(0) === '"' && str.charAt(str.length - 1) === '"') {
        return str.substring(1, str.length - 1);
    }
    if (str.charAt(0) === "'" && str.charAt(str.length - 1) === "'") {
        return str.substring(1, str.length - 1);
    }
    return str;
}

export function hasQuotes(str: string) {
    return (str.at(0) === '"' && str.at(-1) === '"') || (str.at(0) === "'" && str.at(-1) === "'");
}

export function getTagNameRange(document: TextDocument, offset: number, tokenType: TokenType, startOffset: number): Range | null {
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

export function getAttributeRange(document: TextDocument, attributeName: string, startOffset: number, endOffset: number): Range | null {
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
        if (token === TokenType.StartTagClose || token === TokenType.StartTagSelfClose) {
            break;
        }
    }
    return null;
}

function findAuraDeclaration(document: TextDocument, attributeValue: string, htmlDocument: HTMLDocument): Location | null {
    for (const root of htmlDocument.roots) {
        const attributes = root.children.filter((n) => n.tag === 'aura:attribute');
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
    const propertyValue = getAuraBindingValue(document, position, htmlDocument);
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
        if (dotIndex !== -1 && valueRelativeOffset < dotIndex) {
            // we're after the first dot, bail
            return null;
        }
        const valueTrimmed = value.trim();
        const match = AURA_EXPRESSION_REGEX.exec(valueTrimmed);
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
                const match = AURA_EXPRESSION_REGEX.exec(curContent);
                if (match) {
                    const start = match.index;
                    const end = match.index + match[0].length - 1;
                    if (start <= relativeOffset && relativeOffset <= end) {
                        // this just gives us the match within the full regular expression match
                        // we want to make sure we're only on the left most property following
                        // the m, c, v character.
                        const dotIndex = curContent.indexOf('.', start);
                        if (dotIndex !== -1) {
                            const nextDotIndex = curContent.indexOf('.', dotIndex + 1);
                            if (nextDotIndex !== -1) {
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
                        if (dotIndex === -1) {
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
