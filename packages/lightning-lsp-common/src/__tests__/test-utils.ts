import { extname, join, resolve } from 'path';
import { TextDocument } from 'vscode-languageserver';
import URI from 'vscode-uri';
import * as fs from 'fs-extra';

// This is used to distinguish the environment of the OS, otherwise we're going to have problems with windows os routes
const TEST_WORKSPACES = process.env.OS.toLowerCase().includes("windows") ? '../../test-workspaces' : 'test-workspaces';

export const FORCE_APP_ROOT = join(TEST_WORKSPACES, 'sfdx-workspace', 'force-app', 'main', 'default');
export const UTILS_ROOT = join(TEST_WORKSPACES, 'sfdx-workspace', 'utils', 'meta');
export const REGISTERED_EMPTY_FOLDER_ROOT = join(TEST_WORKSPACES, 'sfdx-workspace', 'registered-empty-folder', 'meta');
export const CORE_ALL_ROOT = join(TEST_WORKSPACES, 'core-like-workspace', 'app', 'main', 'core');
export const CORE_PROJECT_ROOT = join(CORE_ALL_ROOT, 'ui-global-components');
export const CORE_MULTI_ROOT = [join(CORE_ALL_ROOT, 'ui-force-components'), join(CORE_ALL_ROOT, 'ui-global-components')];
export const STANDARDS_ROOT = join(TEST_WORKSPACES, 'standard-workspace', 'src', 'modules');

export function readAsTextDocument(path: string): TextDocument {
    const uri = URI.file(resolve(path)).toString();
    const content = fs.readFileSync(path, 'utf-8');
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
