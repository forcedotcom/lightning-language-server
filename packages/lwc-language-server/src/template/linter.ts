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

const TYPOS = ['<lighting-', '<lightening-', '<lihgtning-'];

export default function lintLwcMarkup(document: TextDocument): Diagnostic[] {
    const source = document.getText();
    const { warnings } = templateCompiler(source, {});

    let warningsLwc: Diagnostic[] = warnings.map(warning => {
        const { start = 0, length = 0 } = warning.location || { start: 0, length: 0 };

        return {
            range: toRange(document, start, length),
            message: warning.message,
            severity: LEVEL_MAPPING.get(warning.level),
            source: DIAGNOSTIC_SOURCE,
        };
    });

    const warningsTypos: Diagnostic[] = lintTypos(document);
    warningsLwc = warningsLwc.concat(warningsTypos);
    return warningsLwc;
}

function lintTypos(document: TextDocument): Diagnostic[] {
    const source = document.getText();
    const lines = source.split(/\r?\n/g);

    const errors: Diagnostic[] = [];

    lines.forEach((line, idx) => {
        TYPOS.forEach(typo => {
            const idxTypo = line.indexOf(typo);
            if (idxTypo > -1) {
                errors.push({
                    range: {
                        start: { line: idx, character: idxTypo },
                        end: { line: idx, character: idxTypo + typo.length },
                    },
                    message: `${typo} is not a valid namespace, sure you didn't mean "<lightning-"?`,
                    severity: LEVEL_MAPPING.get(DiagnosticLevel.Error),
                    source: DIAGNOSTIC_SOURCE,
                });
            }
        });
    });

    return errors;
}

function toRange(textDocument: TextDocument, start: number, length: number): Range {
    return Range.create(textDocument.positionAt(start), textDocument.positionAt(start + length));
}
