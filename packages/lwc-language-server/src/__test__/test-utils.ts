import { extname, join, resolve } from 'path';
import { TextDocument } from 'vscode-languageserver';
import URI from 'vscode-uri';
import * as utils from '../utils';

export const FORCE_APP_ROOT = join('test-workspaces', 'sfdx-workspace', 'force-app', 'main', 'default');
export const UTILS_ROOT = join('test-workspaces', 'sfdx-workspace', 'utils', 'meta');
export const CORE_ALL_ROOT = join('test-workspaces', 'core-like-workspace', 'app', 'main', 'core');
export const CORE_PROJECT_ROOT = join(CORE_ALL_ROOT, 'ui-global-components');
export const STANDARDS_ROOT = join('test-workspaces', 'standard-workspace', 'src', 'modules');

export function readAsTextDocument(path: string): TextDocument {
    const uri = URI.file(resolve(path)).toString();
    const content = utils.readFileSync(path);
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
