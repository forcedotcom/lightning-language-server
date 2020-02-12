import { TextDocument } from 'vscode-languageserver';
import { utils } from '@salesforce/lightning-lsp-common';
import { join } from 'path';

const AURA_STANDARD: string = 'aura-standard.json';
const AURA_SYSTEM: string = 'aura-system.json';
const AURA_EXTENSIONS: string[] = ['.cmp', '.app', '.design', '.evt', '.intf', '.auradoc', '.tokens'];

const RESOURCES_DIR = 'resources';

export function isAuraMarkup(textDocument: TextDocument): boolean {
    const fileExt = utils.getExtension(textDocument);
    return AURA_EXTENSIONS.includes(fileExt);
}

export function getAuraStandardResourcePath() {
    return join(__dirname, RESOURCES_DIR, AURA_STANDARD);
}

export function getAuraSystemResourcePath() {
    return join(__dirname, RESOURCES_DIR, AURA_SYSTEM);
}
