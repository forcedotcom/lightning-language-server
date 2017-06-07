import { extname } from 'path';
import { TextDocument, Files } from 'vscode-languageserver';

export function getExtension(textDocument: TextDocument): string {
    const filePath = Files.uriToFilePath(textDocument.uri);
    return filePath ? extname(filePath) : '';
}

export function isTemplate(document: TextDocument): boolean {
    return document.languageId === 'html';
}
