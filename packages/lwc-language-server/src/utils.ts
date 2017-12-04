import { extname, join } from 'path';
import * as fs from 'fs';
import { TextDocument, Files } from 'vscode-languageserver';

const RESOURCES_DIR = 'resources';
const LWC_STANDARD: string = 'lwc-standard.json';

export function getExtension(textDocument: TextDocument): string {
    const filePath = Files.uriToFilePath(textDocument.uri);
    return filePath ? extname(filePath) : '';
}

export function isTemplate(document: TextDocument): boolean {
    return document.languageId === 'html';
}

export function isJavascript(document: TextDocument): boolean {
    return document.languageId === 'javascript';
}

export function getResourcePath(resourceName: string) {
    return join(__dirname, RESOURCES_DIR, resourceName);
}

export function getlwcStandardResourcePath() {
    return join(__dirname, RESOURCES_DIR, LWC_STANDARD);
}

export function getSfdxResource(resourceName: string) {
    return join(__dirname, RESOURCES_DIR, 'sfdx', resourceName);
}

export function isSfdxProject(workspaceRoot: string) {
    return fs.existsSync(join(workspaceRoot, 'sfdx-project.json'));
}
