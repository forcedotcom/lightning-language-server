import * as fs from 'fs';
import { transform } from '../resources/lwc/compiler';
import { TextDocument, Diagnostic, DiagnosticSeverity, Range } from 'vscode-languageserver';
import { DIAGNOSTIC_SOURCE } from '../constants';
import * as path from 'path';
import URI from 'vscode-uri';

export interface ICompilerMetadata {
    apiProperties: Array<{ name: string }>;
    doc: string;
    declarationLoc: { start: { line: number, column: number }, end: { line: number, column: number } };
}

export interface ICompilerResult {
    diagnostics?: Diagnostic[];
    result?: { map: { names: string[] }, metadata: ICompilerMetadata };
}

/**
 * Use to compile a live document (contents may be different from current file in disk)
 */
export async function compileDocument(document: TextDocument): Promise<ICompilerResult> {
    const file = URI.parse(document.uri).path;
    const filePath = path.parse(file);
    const fileName = filePath.base;
    return compileSource(document.getText(), fileName);
}

export async function compileFile(file: string): Promise<ICompilerResult> {
    const filePath = path.parse(file);
    const fileName = filePath.base;
    return compileSource(fs.readFileSync(file, 'utf8'), fileName);
}

export async function compileSource(source: string, fileName: string = 'foo.js'): Promise<ICompilerResult> {
    try {
        // TODO: need proper id/moduleNamespace/moduleName?
        const result = await transform(source, fileName, { moduleNamespace: 'x', moduleName: 'foo' });
        return { result, diagnostics: [] };
    } catch (err) {
        return { diagnostics: [toDiagnostic(err)] };
    }
}

export function extractAttributes(metadata: ICompilerMetadata): string[] {
    return metadata.apiProperties.map(x => x.name);
}

// TODO: proper type for 'err' (i.e. SyntaxError)
function toDiagnostic(err: any): Diagnostic {
    // TODO: 'err' doesn't have end loc, squiggling until the end of the line until babel 7 is released
    const startLine: number = err.loc.line - 1;
    const startCharacter: number = err.loc.column;
    const range: Range = Range.create(startLine, startCharacter, startLine, Number.MAX_VALUE);
    return {
        range,
        severity: DiagnosticSeverity.Error,
        source: DIAGNOSTIC_SOURCE,
        message: err.message,
    };
}
