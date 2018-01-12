import { templateCompiler } from '../resources/lwc/compiler';
import { TextDocument, Diagnostic, DiagnosticSeverity, Range } from 'vscode-languageserver';
import { DIAGNOSTIC_SOURCE } from '../constants';

const LEVEL_MAPPING = {
    info: DiagnosticSeverity.Information,
    warning: DiagnosticSeverity.Warning,
    error: DiagnosticSeverity.Error,
};

export default function lint(document: TextDocument): Diagnostic[] {
    const source = document.getText();
    const { warnings } = templateCompiler(source, {});

    return warnings.map(warning => ({
        range: toRange(document, warning.start, warning.length),
        message: warning.message,
        severity: LEVEL_MAPPING[warning.level],
        source: DIAGNOSTIC_SOURCE,
    }));
}

function toRange(textDocument: TextDocument, start: number, length: number): Range {
    return Range.create(textDocument.positionAt(start), textDocument.positionAt(start + length));
}
