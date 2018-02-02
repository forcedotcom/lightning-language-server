import { parse, join } from 'path';
import { Glob } from 'glob';
import { FileEvent, FileChangeType } from 'vscode-languageserver';
import { WorkspaceContext } from '../context';
import * as utils from '../utils';

const STATIC_RESOURCE_DECLARATION_FILE = '.sfdx/typings/lwc/staticresources.d.ts';
const STATIC_RESOURCES: Set<string> = new Set();

function getResourceName(resourceFile: string) {
    return parse(resourceFile).name;
}

export async function updateStaticResourceIndex(updatedFiles: FileEvent[], { workspaceRoot }: WorkspaceContext) {
    let didChange = false;
    updatedFiles.forEach(f => {
        if (f.uri.endsWith('.resource')) {
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
    const STATIC_RESOURCE_GLOB_PATTERN = `${sfdxPackageDirsPattern}/**/staticresources/*.resource`;
    return new Promise((resolve, reject) => {
        /* tslint:disable */
        new Glob(STATIC_RESOURCE_GLOB_PATTERN, { cwd: workspacePath }, async (err: Error, files: string[]) => {
            if (err) {
                console.log(`Error queing up indexing of static resources.Error detatils: ${err}`);
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
    const result = `declare module "@resource-url/${resourceName}" {
    var ${resourceName}: string;
    export default ${resourceName};
}
`;
    return result;
}
