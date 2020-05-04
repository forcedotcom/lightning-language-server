import { CodeAction, CodeActionParams, Diagnostic, CodeActionKind, TextDocument, Range } from 'vscode-languageserver';
import { isNullOrUndefined } from 'util';
import {
    QUICKFIX_LIGHTNING_TYPO,
    QUICKFIX_AMBIGUOUS_ATTR,
    QUICKFIX_DISALLOWED_COMP_PROP,
    QUICKFIX_ITERATOR_EXPRESSION,
    QUICKFIX_FOREACH_EXPRESSION,
    QUICKFIX_FORINDEX_STRING,
    QUICKFIX_FORITEM_STRING,
    QUICKFIX_IF_EXPRESSION,
    QUICKFIX_DISALLOWED_EXPRESSION,
    QUICKFIX_KEY_EXPRESSION,
    QUICKFIX_INSERT_KEY,
    QUICKFIX_UNEXPECTED_IF,
    QUICKFIX_INVALID_DECORATOR,
    MSG_QUICKFIX_LIGHTNING_TYPO,
    MSG_QUICKFIX_CONVERT_TO_EXPRESSION,
    MSG_QUICKFIX_CONVERT_TO_STRING,
    MSG_QUICKFIX_IMPORT_DECORATOR,
    MSG_QUICKFIX_IF_FALSE,
    MSG_QUICKFIX_IF_TRUE,
    MSG_QUICKFIX_AMBIGUITY,
    MSG_QUICKFIX_FIX_INVALID_EXPRESSION,
    MSG_QUICKFIX_INSERT_KEY,
} from './constants';

/**
 * @export
 * @param {TextDocument} textDocument
 * @param {CodeActionParams} parms
 * @returns {CodeAction[]}
 */
export function quickfix(document: TextDocument, params: CodeActionParams): CodeAction[] {
    const diagnostics = params.context.diagnostics;
    if (isNullOrUndefined(diagnostics) || diagnostics.length === 0) {
        return [];
    }

    let codeActions: CodeAction[] = [];
    diagnostics.forEach(diag => {
        const msg = diag.message;
        switch (true) {
            case msg.includes(QUICKFIX_LIGHTNING_TYPO):
                codeActions.push(quickfixLightningTypo(document, diag));
                break;
            case msg.includes(QUICKFIX_ITERATOR_EXPRESSION) ||
                msg.includes(QUICKFIX_FOREACH_EXPRESSION) ||
                msg.includes(QUICKFIX_IF_EXPRESSION) ||
                msg.includes(QUICKFIX_KEY_EXPRESSION):
                codeActions.push(quickfixToExpression(document, diag));
                break;
            case msg.includes(QUICKFIX_FORINDEX_STRING) || msg.includes(QUICKFIX_FORITEM_STRING):
                codeActions.push(quickfixToString(document, diag));
                break;
            case msg.includes(QUICKFIX_INVALID_DECORATOR):
                codeActions.push(quickfixDecoratorNotImported(document, diag));
                break;
            case msg.includes(QUICKFIX_UNEXPECTED_IF):
                codeActions.push(quickfixUnexpectedIfTrue(document, diag));
                codeActions.push(quickfixUnexpectedIfFalse(document, diag));
                break;
            case msg.includes(QUICKFIX_AMBIGUOUS_ATTR):
                codeActions.push(quickfixAmbiguousAttributeExpression(document, diag));
                break;
            case msg.includes(QUICKFIX_DISALLOWED_EXPRESSION) || msg.includes(QUICKFIX_DISALLOWED_COMP_PROP):
                codeActions.push(quickfixDisallowedExpression(document, diag));
                break;
            case msg.includes(QUICKFIX_INSERT_KEY):
                codeActions.push(quickfixInsertKey(document, diag));
                break;
        }
    });
    codeActions = codeActions.filter(el => {
        return el != null;
    });
    return codeActions;
}

function quickfixLightningTypo(document: TextDocument, diagnostic: Diagnostic): CodeAction {
    return buildQuickFix(diagnostic, document.uri, MSG_QUICKFIX_LIGHTNING_TYPO, '<lightning-');
}

function quickfixToExpression(document: TextDocument, diagnostic: Diagnostic): CodeAction {
    let newText = document.getText(diagnostic.range);
    if (newText.indexOf('{') === -1) {
        if (newText.indexOf('="') > -1) {
            newText = replaceStringAtIndex(newText, newText.indexOf('"'), '{');
        } else {
            newText = replaceStringAtIndex(newText, newText.indexOf('='), '={');
        }
    }
    if (newText.indexOf('}') === -1) {
        if (newText.indexOf('"') > -1) {
            newText = replaceStringAtIndex(newText, newText.indexOf('"'), '}');
        } else {
            newText = newText.concat('}');
        }
    }
    return buildQuickFix(diagnostic, document.uri, MSG_QUICKFIX_CONVERT_TO_EXPRESSION, newText);
}

function quickfixToString(document: TextDocument, diagnostic: Diagnostic): CodeAction {
    const newText = document
        .getText(diagnostic.range)
        .replace('{', '"')
        .replace('}', '"');
    return buildQuickFix(diagnostic, document.uri, MSG_QUICKFIX_CONVERT_TO_STRING, newText);
}

function quickfixDecoratorNotImported(document: TextDocument, diagnostic: Diagnostic): CodeAction {
    const validDecorators = ['api', 'track', 'wire'];
    const importsRange = getLwcImportsRange(document);
    const newText = document.getText(diagnostic.range);
    const decorator = newText.substring(1, newText.indexOf(' '));
    if (validDecorators.indexOf(decorator.toLowerCase()) === -1) {
        return null;
    }
    return buildQuickFix(diagnostic, document.uri, MSG_QUICKFIX_IMPORT_DECORATOR.replace('@', decorator), `, ${decorator} `, importsRange);
}

function quickfixUnexpectedIfFalse(document: TextDocument, diagnostic: Diagnostic): CodeAction {
    const newText = document.getText(diagnostic.range).replace(/if:.*=/, 'if:false=');
    return buildQuickFix(diagnostic, document.uri, MSG_QUICKFIX_IF_FALSE, newText);
}

function quickfixUnexpectedIfTrue(document: TextDocument, diagnostic: Diagnostic): CodeAction {
    const newText = document.getText(diagnostic.range).replace(/if:.*=/, 'if:true=');
    return buildQuickFix(diagnostic, document.uri, MSG_QUICKFIX_IF_TRUE, newText);
}

function quickfixAmbiguousAttributeExpression(document: TextDocument, diagnostic: Diagnostic): CodeAction {
    const directivesExpression = ['for:each', 'iterator:it', 'if:true', 'if:false', 'key='];
    const needsExpression = directivesExpression.some(value => diagnostic.message.indexOf(value) > -1);
    const newText = needsExpression
        ? document
              .getText(diagnostic.range)
              .replace('"{', '{')
              .replace('}"', '}')
        : document
              .getText(diagnostic.range)
              .replace('"{', '"')
              .replace('}"', '"');
    return buildQuickFix(diagnostic, document.uri, MSG_QUICKFIX_AMBIGUITY, newText);
}

function quickfixDisallowedExpression(document: TextDocument, diagnostic: Diagnostic): CodeAction {
    let newText = document.getText(diagnostic.range).replace('()', ''); // CallExpression
    newText = newText.replace(/!/g, ''); // UnaryExpression
    newText = newText.replace(/\[.*\]/, ''); // NumericLiteral / computed property access
    return buildQuickFix(diagnostic, document.uri, MSG_QUICKFIX_FIX_INVALID_EXPRESSION, newText);
}

function quickfixInsertKey(document: TextDocument, diagnostic: Diagnostic): CodeAction {
    const message = document.getText(diagnostic.range);
    const tagIndex = message.search(/>/);
    const newText = [message.slice(0, tagIndex), ' key={}', message.slice(tagIndex)].join('');
    return buildQuickFix(diagnostic, document.uri, MSG_QUICKFIX_INSERT_KEY, newText);
}

function buildQuickFix(diagnostic: Diagnostic, uri: string, title: string, newText: string, range?: Range): CodeAction {
    return {
        title,
        kind: CodeActionKind.QuickFix,
        diagnostics: [diagnostic],
        edit: {
            changes: {
                [uri]: [
                    {
                        range: range ? range : diagnostic.range,
                        newText,
                    },
                ],
            },
        },
    };
}

function getLwcImportsRange(document: TextDocument): any {
    const source = document.getText();
    const index = source.search(/ } from {"|'}lwc{"|'};/g);
    return toRange(document, index, 1);
}

function toRange(textDocument: TextDocument, start: number, length: number): Range {
    return Range.create(textDocument.positionAt(start), textDocument.positionAt(start + length));
}

function replaceStringAtIndex(value: string, index: number, replacement: string) {
    if (index >= value.length) {
        return value.valueOf();
    }
    return value.substring(0, index) + replacement + value.substring(index + 1);
}
