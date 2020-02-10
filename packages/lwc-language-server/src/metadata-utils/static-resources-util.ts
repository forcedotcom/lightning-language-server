import { parse, join } from 'path';
import { Glob } from 'glob';
import { FileEvent, FileChangeType } from 'vscode-languageserver';
import { WorkspaceContext } from '@salesforce/lightning-lsp-common';
import { promisify } from 'util';
import * as fs from 'fs-extra';

const glob = promisify(Glob);

const STATIC_RESOURCE_DECLARATION_FILE = '.sfdx/typings/lwc/staticresources.d.ts';
const STATIC_RESOURCES: Set<string> = new Set();

export function resetStaticResources() {
    STATIC_RESOURCES.clear();
}

function getResourceName(resourceMetaFile: string) {
    const resourceFile = resourceMetaFile.substring(0, resourceMetaFile.lastIndexOf('-'));
    return parse(resourceFile).name;
}

export async function updateStaticResourceIndex(updatedFiles: FileEvent[], { workspaceRoots }: WorkspaceContext, writeConfigs: boolean = true) {
    let didChange = false;
    for (const f of updatedFiles) {
        if (f.uri.endsWith('.resource-meta.xml')) {
            if (f.type === FileChangeType.Created) {
                didChange = true;
                STATIC_RESOURCES.add(getResourceName(f.uri));
            } else if (f.type === FileChangeType.Deleted) {
                STATIC_RESOURCES.delete(getResourceName(f.uri));
                didChange = true;
            }
        }
    }
    if (didChange) {
        return processStaticResources(workspaceRoots[0], writeConfigs);
    }
}

async function processStaticResources(workspace: string, writeConfigs: boolean): Promise<void> {
    if (STATIC_RESOURCES.size > 0 && writeConfigs) {
        return fs.writeFile(join(workspace, STATIC_RESOURCE_DECLARATION_FILE), generateResourceTypeDeclarations());
    }
}

export async function indexStaticResources(context: WorkspaceContext, writeConfigs: boolean = true): Promise<void> {
    const { workspaceRoots } = context;
    const { sfdxPackageDirsPattern } = await context.getSfdxProjectConfig();
    const STATIC_RESOURCE_GLOB_PATTERN = `${sfdxPackageDirsPattern}/**/staticresources/*.resource-meta.xml`;
    try {
        const files: string[] = await glob(STATIC_RESOURCE_GLOB_PATTERN, { cwd: workspaceRoots[0] });
        for (const file of files) {
            STATIC_RESOURCES.add(getResourceName(file));
        }
        processStaticResources(workspaceRoots[0], writeConfigs);
    } catch (err) {
        console.log(`Error queuing up indexing of static resources. Error details:`, err);
        throw err;
    }
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
