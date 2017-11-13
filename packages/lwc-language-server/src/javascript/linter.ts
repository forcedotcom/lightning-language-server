import { transform } from 'raptor-compiler';
import { TextDocument, Diagnostic, DiagnosticSeverity, Range } from 'vscode-languageserver';
import { DIAGNOSTIC_SOURCE } from '../constants';

export default async function lint(document: TextDocument): Promise<Diagnostic[]> {
    const source = document.getText();

    try {
        // TODO: need proper id/moduleNamespace/moduleName?
        await transform(source, "foo.js", { moduleNamespace: 'x', moduleName: 'foo' });
    } catch (err) {
        return [toDiagnostic(err)];
    }

    return [];
}

// TODO: proper type for 'err' (i.e. SyntaxError)
function toDiagnostic(err: any): Diagnostic {
    // TODO: 'err' doesn't have end loc
    const startLine: number = err.loc.line - 1;
    const startCharacter: number = err.loc.column;
    const range: Range = Range.create(startLine, startCharacter, startLine, startCharacter + 1);
    return {
        range,
        severity: DiagnosticSeverity.Error,
        source: DIAGNOSTIC_SOURCE,
        message: err.message,
    };
}
