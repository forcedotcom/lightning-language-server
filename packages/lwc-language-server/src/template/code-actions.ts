import { CodeAction, CodeActionParams, DiagnosticSeverity, CodeActionKind, TextDocument } from 'vscode-languageserver';
import { isNullOrUndefined } from 'util';

// tslint:disable-next-line:quotemark
export const QUICKFIX_LIGHTNING_TYPO = 'is not a valid namespace, sure you didn\'t mean "<lightning-"?';

/**
 * @export
 * @param {TextDocument} textDocument
 * @param {CodeActionParams} parms
 * @returns {CodeAction[]}
 */
export function quickfix(textDocument: TextDocument, params: CodeActionParams): CodeAction[] {
    const diagnostics = params.context.diagnostics;
    if (isNullOrUndefined(diagnostics) || diagnostics.length === 0) {
        return [];
    }

    const codeActions: CodeAction[] = [];
    diagnostics.forEach(diag => {
        if (diag.severity === DiagnosticSeverity.Error && diag.message.includes(QUICKFIX_LIGHTNING_TYPO)) {
            codeActions.push({
                title: 'Replace tag with <lightning-',
                kind: CodeActionKind.QuickFix,
                diagnostics: [diag],
                edit: {
                    changes: {
                        [params.textDocument.uri]: [
                            {
                                range: diag.range,
                                newText: '<lightning-',
                            },
                        ],
                    },
                },
            });
            return;
        }
    });

    return codeActions;
}
