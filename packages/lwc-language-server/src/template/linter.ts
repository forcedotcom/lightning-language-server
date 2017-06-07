import templateCompiler from 'raptor-template-compiler';
import { TextDocument, Diagnostic, DiagnosticSeverity, Range } from 'vscode-languageserver';

import { getExtension } from '../utils'; 

const LEVEL_MAPPING = {
    'info': DiagnosticSeverity.Information,
    'warning': DiagnosticSeverity.Warning,
    'error': DiagnosticSeverity.Error,
}

export default function lint(document: TextDocument): Diagnostic[] {
    const source = document.getText();
    const { warnings } = templateCompiler(source);

    return warnings.map(warning => ({
        range: toRange(document, warning.start, warning.length),
        message: warning.message,
        severity: LEVEL_MAPPING[warning.level],
        source: 'raptor'
    }));
}

function toRange(textDocument: TextDocument, start: number, length: number): Range {
    return Range.create(
        textDocument.positionAt(start),
        textDocument.positionAt(start + length),
    )
}