import {
    TextDocument,
    Position,
    CompletionItem,
    CompletionItemKind,
    TextEdit,
    InsertTextFormat,
} from 'vscode-languageserver';

import { parse as parseHTML } from './html/parser';

import { TokenType, ScannerState, createScanner } from './html/scanner';

enum AttributeValueType {
    String,
    Expression,
}

class RaptorCompletionItem implements CompletionItem {
    constructor(
        readonly label: string,
        readonly documentation: string,
        readonly kind: CompletionItemKind,
        readonly valueType: AttributeValueType,
    ) {}
}

const FunctionAutoComplete = CompletionItemKind.Function;

const RAPTOR_COMPLETION_ITEMS: RaptorCompletionItem[] = [
    new RaptorCompletionItem(
        'for:each',
        'Renders the element or template block multiple times based on the expression value.',
        FunctionAutoComplete,
        AttributeValueType.Expression,
    ),
    new RaptorCompletionItem(
        'for:item',
        'Bind the current iteration item to an identifier.',
        FunctionAutoComplete,
        AttributeValueType.String,
    ),
    new RaptorCompletionItem(
        'for:index',
        'Bind the current iteration index to an identifier.',
        FunctionAutoComplete,
        AttributeValueType.String,
    ),
    new RaptorCompletionItem(
        'if:true',
        'Renders the element or template if the expression value is thruthy.',
        FunctionAutoComplete,
        AttributeValueType.Expression,
    ),
    new RaptorCompletionItem(
        'if:false',
        'Renders the element or template if the expression value is falsy.',
        FunctionAutoComplete,
        AttributeValueType.Expression,
    ),
];

export default function doCompilation(
    document: TextDocument,
    position: Position,
): CompletionItem[] {
    const results: CompletionItem[] = [];

    const text = document.getText();
    const htmlDocument = parseHTML(text);

    const offset = document.offsetAt(position);

    const node = htmlDocument.findNodeAt(offset);
    const nodeRoot = htmlDocument.roots.includes(node);

    if (!node) {
        return results;
    }

    const scanner = createScanner(text, node.start);

    // @ts-ignore: may use in the future
    let currentTag: string;
    // @ts-ignore: may use in the future
    let currentAttributeName: string;

    function collectAttributeNameSuggestions(
        nameStart: number,
        nameEnd: number = offset,
    ): CompletionItem[] {
        const name = text.slice(nameStart, nameEnd);
        const isSnippet = !isFollowedBy(
            text,
            nameEnd,
            ScannerState.AfterAttributeName,
            TokenType.DelimiterAssign,
        );
        const matchingDirectives = RAPTOR_COMPLETION_ITEMS.filter(item =>
            item.label.startsWith(name),
        );

        // No attribute can be applied on the root element
        if (nodeRoot) {
            return [];
        }

        return matchingDirectives.map(item => {
            let editValue = item.label;

            if (isSnippet) {
                switch (item.valueType) {
                    case AttributeValueType.Expression:
                        editValue += '={$1}';
                        break;

                    case AttributeValueType.String:
                    default:
                        editValue += '="$1"';
                        break;
                }
            }

            return {
                label: item.label,
                kind: item.kind,
                documentation: item.documentation,
                textEdit: TextEdit.replace(
                    {
                        start: document.positionAt(nameStart),
                        end: document.positionAt(nameEnd),
                    },
                    editValue,
                ),
                insertTextFormat: InsertTextFormat.Snippet,
            };
        });
    }

    let token = scanner.scan();
    while (token !== TokenType.EOS && scanner.getTokenOffset() <= offset) {
        switch (token) {
            case TokenType.StartTagOpen:
                if (scanner.getTokenEnd() === offset) {
                    // TODO: Collect tag name suggestions, retrieve all the available raptor components
                    return results;
                }
                break;
            case TokenType.StartTag:
                if (
                    scanner.getTokenOffset() <= offset &&
                    offset <= scanner.getTokenEnd()
                ) {
                    // TODO: Collect matching tag name suggestion, retrieve matching raptor components
                    return results;
                }
                currentTag = scanner.getTokenText();
                break;
            case TokenType.AttributeName:
                if (
                    scanner.getTokenOffset() <= offset &&
                    offset <= scanner.getTokenEnd()
                ) {
                    // TODO: Collect available attributes on the specific element, use the @api properties
                    return collectAttributeNameSuggestions(
                        scanner.getTokenOffset(),
                        scanner.getTokenEnd(),
                    );
                }
                currentAttributeName = scanner.getTokenText();
                break;
            case TokenType.DelimiterAssign:
                if (scanner.getTokenEnd() === offset) {
                    // TODO: Collect available attributes.
                    // Not sure how to use it, the AttributeValue token looks more interesting
                    return results;
                }
                break;
            case TokenType.AttributeValue:
                if (
                    scanner.getTokenOffset() <= offset &&
                    offset <= scanner.getTokenEnd()
                ) {
                    // TODO: Collect matching attribute values, check if the first character is {
                    return results;
                }
                break;
            case TokenType.Whitespace:
                if (offset <= scanner.getTokenEnd()) {
                    switch (scanner.getScannerState()) {
                        case ScannerState.AfterOpeningStartTag:
                            // TODO: Collect available tag name
                            return results;
                        case ScannerState.WithinTag:
                        case ScannerState.AfterAttributeName:
                            return collectAttributeNameSuggestions(
                                scanner.getTokenEnd(),
                            );
                        case ScannerState.BeforeAttributeValue:
                            // TODO: Collect attribute values
                            return results;
                    }
                }
                break;
            default:
                if (offset <= scanner.getTokenEnd()) {
                    return results;
                }
                break;
        }
        token = scanner.scan();
    }
    return results;
}

function isFollowedBy(
    s: string,
    offset: number,
    intialState: ScannerState,
    expectedToken: TokenType,
) {
    const scanner = createScanner(s, offset, intialState);
    let token = scanner.scan();
    while (token === TokenType.Whitespace) {
        token = scanner.scan();
    }
    return token === expectedToken;
}
