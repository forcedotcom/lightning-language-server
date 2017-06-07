import { extname } from 'path';
import { TextDocument, Files, Range, Position } from 'vscode-languageserver';

export function getExtension(textDocument: TextDocument): string {
    const filePath = Files.uriToFilePath(textDocument.uri);
    return filePath ? extname(filePath) : '';
}

export function isTemplate(document: TextDocument): boolean {
    return getExtension(document) !== '.html'
}