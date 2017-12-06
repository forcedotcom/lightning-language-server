import { extname, join } from 'path';
import * as fs from 'fs';
import * as path from 'path';
import { TextDocument, Files } from 'vscode-languageserver';

const RESOURCES_DIR = 'resources';
const LWC_STANDARD: string = 'lwc-standard.json';

export function getExtension(textDocument: TextDocument): string {
    const filePath = Files.uriToFilePath(textDocument.uri);
    return filePath ? extname(filePath) : '';
}

export function isTemplate(document: TextDocument): boolean {
    return document.languageId === 'html' && getExtension(document) === '.html';
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

/**
 * @return string showing elapsed milliseconds from start mark
 */
export function elapsedMillis(start: [number, number]): string {
    const elapsed = process.hrtime(start);
    return (elapsed[0] * 1000 + elapsed[1] / 1e6).toFixed(2) + ' ms';
}

/**
 * @param root directory to start searching from
 * @return module namespaces root folders found inside 'root'
 */
export function findNamespaceRoots(root: string, maxDepth: number = 5): string[] {
    const roots: string[] = [];

    function isModuleRoot(subdirs: string[]): boolean {
        // is a root if any subdir matches a name/name.js with name.js being a module
        for (const subdir of subdirs) {
            const basename = path.basename(subdir);
            const modulePath = path.join(subdir, basename + '.js');
            if (fs.existsSync(modulePath) && fs.existsSync(path.join(subdir, basename + '.html'))) {
                // TODO: check contents for: from 'engine'?
                return true;
            }
        }
        return false;
    }

    function traverse(candidate: string, depth: number): void {
        if (--depth < 0) {
            return;
        }

        // skip traversing node_modules and similar
        const filename = path.basename(candidate);
        if (filename === 'node_modules' || filename === 'bin' || filename === 'target'
            || filename === 'jest-modules' || filename === 'components' || filename === 'repository') {
            return;
        }

        const subdirs = findSubdirectories(candidate);
        if (isModuleRoot(subdirs)) {
            roots.push(candidate);
        } else {
            for (const subdir of subdirs) {
                traverse(subdir, depth);
            }
        }
    }

    traverse(root, maxDepth);
    return roots;
}

function findSubdirectories(dir: string): string[] {
    const subdirs: string[] = [];
    for (const file of fs.readdirSync(dir)) {
        const subdir = path.join(dir, file);
        if (fs.statSync(subdir).isDirectory()) {
            subdirs.push(subdir);
        }
    }
    return subdirs;
}

/**
 * @return list of .js modules inside namespaceRoot folder
 */
function findModulesIn(namespaceRoot: string): string[] {
    const files: string[] = [];
    const subdirs = findSubdirectories(namespaceRoot);
    for (const subdir of subdirs) {
        const basename = path.basename(subdir);
        const modulePath = path.join(subdir, basename + '.js');
        if (fs.existsSync(modulePath) && fs.existsSync(path.join(subdir, basename + '.html'))) {
            // TODO: check contents for: from 'engine'?
            files.push(modulePath);
        }
    }
    return files;
}

export function findModules(namespaceRoots: string[]): string[] {
    const files: string[] = [];
    namespaceRoots.forEach((namespaceRoot) => {
        files.push.apply(files, findModulesIn(namespaceRoot));
    });
    return files;
}
