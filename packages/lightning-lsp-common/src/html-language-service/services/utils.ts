import { createScanner } from '../parser/htmlScanner';
import { TextDocument, Range, Position, Location } from 'vscode-languageserver-types';
import { TokenType } from '../htmlLanguageTypes';

export function stripQuotes(str: string | null) {
    if (!str) return str;
    if (str.charAt(0) === '"' && str.charAt(str.length - 1) === '"') {
        return str.substr(1, str.length - 2);
    }
    if (str.charAt(0) === "'" && str.charAt(str.length - 1) === "'") {
        return str.substr(1, str.length - 2);
    }
    return str;
}
export function hasQuotes(str: string) {
    return (str.charAt(0) === '"' && str.charAt(str.length - 1) === '"') || (str.charAt(0) === "'" && str.charAt(str.length - 1) === "'");
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
        if (token === TokenType.StartTagClose || token == TokenType.StartTagSelfClose) {
            break;
        }
    }
    return null;
}
