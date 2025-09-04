import * as ts from 'typescript';
import { TextDocument } from 'vscode-languageserver';
import * as path from 'path';
import { URI } from 'vscode-uri';

/**
 * Exclude some special importees that we don't need to analyze.
 * The importees that are not needed include the following.
 * 'lwc', 'lightning/*', '@salesforce/*', './', '../', '*.html', '*.css'.
 * @param moduleSpecifier name of the importee.
 * @returns true if the importee should be included for analyzing.
 */
function shouldIncludeImports(moduleSpecifier: string): boolean {
    // excludes a few special imports
    const exclusions = ['lightning/', '@salesforce/', './', '../'];
    for (const exclusion of exclusions) {
        if (moduleSpecifier.startsWith(exclusion)) {
            return false;
        }
    }
    // exclude html, css imports, and lwc imports
    return !moduleSpecifier.endsWith('.html') && !moduleSpecifier.endsWith('.css') && moduleSpecifier !== 'lwc';
}

/**
 * Adds an importee specifier to a set of importees.
 */
function addImports(imports: Set<string>, importText: string): void {
    if (importText && shouldIncludeImports(importText)) {
        imports.add(importText);
    }
}

/**
 * Parse a typescript file and collects all importees that we need to analyze.
 * @param src ts source file
 * @returns a set of strings containing the importees
 */
export function collectImports(src: ts.SourceFile): Set<string> {
    const imports = new Set<string>();
    const walk = (node: ts.Node): void => {
        if (ts.isImportDeclaration(node)) {
            // ES2015 import
            const moduleSpecifier = node.moduleSpecifier as ts.StringLiteral;
            addImports(imports, moduleSpecifier.text);
        } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
            // Dynamic import()
            const moduleSpecifier = node.arguments[0];
            if (ts.isStringLiteral(moduleSpecifier)) {
                addImports(imports, moduleSpecifier.text);
            }
        }
        ts.forEachChild(node, walk);
    };
    walk(src);
    return imports;
}

/**
 * Collect a set of importees for a TypeScript document.
 * @param document a TypeScript document
 * @returns a set of strings containing the importees
 */
export async function collectImportsForDocument(document: TextDocument): Promise<Set<string>> {
    const filePath = URI.file(document.uri).fsPath;
    const content = document.getText();
    const fileName = path.parse(filePath).base;
    const srcFile = ts.createSourceFile(fileName, content, ts.ScriptTarget.ESNext);
    return collectImports(srcFile);
}
