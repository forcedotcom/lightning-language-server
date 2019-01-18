import { DiagnosticLevel } from '@lwc/errors';
import templateCompiler from '@lwc/template-compiler';
import { TextDocument, Diagnostic, DiagnosticSeverity, Range } from 'vscode-languageserver';
import { DIAGNOSTIC_SOURCE } from '../constants';

const LEVEL_MAPPING: Map<DiagnosticLevel, DiagnosticSeverity> = new Map([
    [DiagnosticLevel.Log, DiagnosticSeverity.Information],
    [DiagnosticLevel.Warning, DiagnosticSeverity.Warning],
    [DiagnosticLevel.Error, DiagnosticSeverity.Error],
    [DiagnosticLevel.Fatal, DiagnosticSeverity.Error],
]);

export default function lint(document: TextDocument): Diagnostic[] {
    const source = document.getText();
    const { warnings } = templateCompiler(source, {});

    return warnings.map(warning => {
        const { start = 0, length = 0 } = warning.location || { start: 0, length: 0 };

        return {
            range: toRange(document, start, length),
            message: warning.message,
            severity: LEVEL_MAPPING.get(warning.level),
            source: DIAGNOSTIC_SOURCE,
        };
    });
}

function toRange(textDocument: TextDocument, start: number, length: number): Range {
    return Range.create(textDocument.positionAt(start), textDocument.positionAt(start + length));
}
