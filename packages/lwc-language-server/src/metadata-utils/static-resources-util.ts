import { parse, join } from 'path';
import { Glob } from 'glob';
import { FileEvent, FileChangeType } from 'vscode-languageserver';
import { utils, WorkspaceContext } from 'lightning-lsp-common';

const STATIC_RESOURCE_DECLARATION_FILE = '.sfdx/typings/lwc/staticresources.d.ts';
const STATIC_RESOURCES: Set<string> = new Set();

export function resetStaticResources() {
    STATIC_RESOURCES.clear();
}

function getResourceName(resourceMetaFile: string) {
    const resourceFile = resourceMetaFile.substring(0, resourceMetaFile.lastIndexOf('-'));
    return parse(resourceFile).name;
}

export async function updateStaticResourceIndex(updatedFiles: FileEvent[], { workspaceRoot }: WorkspaceContext) {
    let didChange = false;
    updatedFiles.forEach(f => {
        if (f.uri.endsWith('.resource-meta.xml')) {
            if (f.type === FileChangeType.Created) {
                didChange = true;
                STATIC_RESOURCES.add(getResourceName(f.uri));
            } else if (f.type === FileChangeType.Deleted) {
                STATIC_RESOURCES.delete(getResourceName(f.uri));
                didChange = true;
            }
        }
    });
    if (didChange) {
        processStaticResources(workspaceRoot);
    }
}

function processStaticResources(workspace: string) {
    if (STATIC_RESOURCES.size > 0) {
        utils.writeFileSync(join(workspace, STATIC_RESOURCE_DECLARATION_FILE), generateResourceTypeDeclarations());
    }
}

export function indexStaticResources(workspacePath: string, sfdxPackageDirsPattern: string): Promise<void> {
    const STATIC_RESOURCE_GLOB_PATTERN = `${sfdxPackageDirsPattern}/**/staticresources/*.resource-meta.xml`;
    return new Promise((resolve, reject) => {
        /* tslint:disable */
        new Glob(STATIC_RESOURCE_GLOB_PATTERN, { cwd: workspacePath }, async (err: Error, files: string[]) => {
            if (err) {
                console.log(`Error queuing up indexing of static resources. Error details: ${err}`);
                reject(err);
            } else {
                files.map((file: string) => {
                    STATIC_RESOURCES.add(getResourceName(file));
                });
                processStaticResources(workspacePath);
                resolve();
            }
        });
        /* tslint:enable */
    });
}

function generateResourceTypeDeclarations(): string {
    let resTypeDecs = '';
    const sortedStaticResources = Array.from(STATIC_RESOURCES).sort();
    sortedStaticResources.forEach(res => {
        resTypeDecs += generateResourceTypeDeclaration(res);
    });
    return resTypeDecs;
}

function generateResourceTypeDeclaration(resourceName: string) {
    const result = `declare module "@salesforce/resourceUrl/${resourceName}" {
    var ${resourceName}: string;
    export default ${resourceName};
}
`;
    return result;
}
