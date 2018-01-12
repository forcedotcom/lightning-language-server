import * as fs from 'fs';
import { extname, resolve } from 'path';
import { TextDocument } from 'vscode-languageserver';
import URI from 'vscode-uri';

export function readAsTextDocument(path: string): TextDocument {
    const uri = URI.file(resolve(path)).toString();
    const content = fs.readFileSync(path, { encoding: 'utf-8' });
    return TextDocument.create(uri, languageId(path), 0, content);
}

function languageId(path: string): string {
    const suffix = extname(path);
    if (!suffix) {
        return '';
    }
    switch (suffix.substring(1)) {
        case 'js':
            return 'javascript';
        case 'html':
            return 'html';
        case 'app':
        case 'cmp':
            return 'html'; // aura cmps
    }
    throw new Error('todo: ' + path);
}
