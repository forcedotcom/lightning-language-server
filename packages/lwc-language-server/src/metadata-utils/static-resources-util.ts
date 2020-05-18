import { parse, join } from 'path';
import { Glob } from 'glob';
import { FileEvent, FileChangeType } from 'vscode-languageserver';
import { WorkspaceContext } from '@salesforce/lightning-lsp-common';
import { promisify } from 'util';
import * as fs from 'fs-extra';

const glob = promisify(Glob);

const STATIC_RESOURCE_DECLARATION_FILE = '.sfdx/typings/lwc/staticresources.d.ts';
const STATIC_RESOURCE_INDEX_FILE = '.sfdx/indexes/lwc/staticresources.json';
let STATIC_RESOURCES: Set<string> = new Set();

export function resetStaticResources() {
    STATIC_RESOURCES.clear();
}

function getResourceName(resourceMetaFile: string) {
    const resourceFile = resourceMetaFile.substring(0, resourceMetaFile.lastIndexOf('-'));
    return parse(resourceFile).name;
}

export async function updateStaticResourceIndex(updates: FileEvent[], { workspaceRoots }: WorkspaceContext, writeConfigs: boolean = true) {
    let didChange = false;

    for (const update of updates) {
        if (update.uri.endsWith('.resource-meta.xml')) {
            const resourceName = getResourceName(update.uri);

            switch (update.type) {
                case FileChangeType.Created:
                    didChange = true;
                    STATIC_RESOURCES.add(resourceName);
                case FileChangeType.Deleted:
                    STATIC_RESOURCES.delete(resourceName);
                    didChange = true;
            }
        }
        if (didChange) {
            return processStaticResources(workspaceRoots[0], writeConfigs);
        }
    }
}

async function processStaticResources(workspace: string, writeConfigs: boolean): Promise<void> {
    if (STATIC_RESOURCES.size > 0 && writeConfigs) {
        const filename = join(workspace, STATIC_RESOURCE_DECLARATION_FILE);
        const fileContent = generateResourceTypeDeclarations();

        return fs.writeFile(filename, fileContent);
    }
}

export async function indexStaticResources(context: WorkspaceContext, writeConfigs: boolean = true): Promise<void> {
    const { workspaceRoots } = context;
    const { sfdxPackageDirsPattern } = await context.getSfdxProjectConfig();
    const STATIC_RESOURCE_GLOB_PATTERN = `${sfdxPackageDirsPattern}/**/staticresources/*.resource-meta.xml`;

    initStaticResourceIndex(workspaceRoots[0]);

    try {
        const files: string[] = await glob(STATIC_RESOURCE_GLOB_PATTERN, { cwd: workspaceRoots[0] });

        for (const file of files) {
            STATIC_RESOURCES.add(getResourceName(file));
        }
        return processStaticResources(workspaceRoots[0], writeConfigs);
    } catch (err) {
        console.log(`Error queuing up indexing of static resources. Error details:`, err);
        throw err;
    }
}

function generateResourceTypeDeclarations(): string {
    return Array.from(STATIC_RESOURCES)
        .sort()
        .map(resourceDeclaration)
        .join('');
}

function resourceDeclaration(resourceName: string) {
    return `declare module "@salesforce/resourceUrl/${resourceName}" {
    var ${resourceName}: string;
    export default ${resourceName};
}
`;
}

function initStaticResourceIndex(workspace: string): Set<string> {
    const indexPath: string = join(workspace, STATIC_RESOURCE_INDEX_FILE);
    const shouldInit: boolean = STATIC_RESOURCES.size === 0 && fs.existsSync(indexPath);

    if (shouldInit) {
        const indexJsonString: string = fs.readFileSync(indexPath, 'utf8');
        const staticIndex = JSON.parse(indexJsonString);
        STATIC_RESOURCES = new Set(staticIndex);
        return STATIC_RESOURCES;
    }
}

export function persistStaticResources(context: WorkspaceContext) {
    const { workspaceRoots } = context;
    const indexPath = join(workspaceRoots[0], STATIC_RESOURCE_INDEX_FILE);
    const index = Array.from(STATIC_RESOURCES);
    const indexJsonString = JSON.stringify(index);

    fs.writeFile(indexPath, indexJsonString);
}
