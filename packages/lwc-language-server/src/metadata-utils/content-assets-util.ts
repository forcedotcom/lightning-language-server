// TODO: make this more generic and reuse code for static resources and this
import { parse, join } from 'path';
import { Glob } from 'glob';
import { FileEvent, FileChangeType } from 'vscode-languageserver';
import { WorkspaceContext } from 'lightning-lsp-common';
import { promisify } from 'util';
import * as fs from 'fs-extra';

const glob = promisify(Glob);

const CONTENT_ASSET_DECLARATION_FILE = '.sfdx/typings/lwc/contentassets.d.ts';
const CONTENT_ASSETS: Set<string> = new Set();

export function resetContentAssets() {
    CONTENT_ASSETS.clear();
}

function getResourceName(resourceMetaFile: string) {
    const resourceFile = resourceMetaFile.substring(0, resourceMetaFile.lastIndexOf('-'));
    return parse(resourceFile).name;
}

export async function updateContentAssetIndex(updatedFiles: FileEvent[], { workspaceRoots }: WorkspaceContext, writeConfigs: boolean = true) {
    let didChange = false;
    for (const f of updatedFiles) {
        if (f.uri.endsWith('.asset-meta.xml')) {
            if (f.type === FileChangeType.Created) {
                didChange = true;
                CONTENT_ASSETS.add(getResourceName(f.uri));
            } else if (f.type === FileChangeType.Deleted) {
                CONTENT_ASSETS.delete(getResourceName(f.uri));
                didChange = true;
            }
        }
    }
    if (didChange) {
        for (const ws of workspaceRoots) {
            processContentAssets(ws, writeConfigs);
        }
        return;
    }
}

function processContentAssets(workspace: string, writeConfig: boolean): Promise<void> {
    if (CONTENT_ASSETS.size > 0 && writeConfig) {
        return fs.writeFile(join(workspace, CONTENT_ASSET_DECLARATION_FILE), generateTypeDeclarations());
    }
}

export async function indexContentAssets(context: WorkspaceContext, writeConfigs: boolean): Promise<void> {
    const { workspaceRoots } = context;
    // const { sfdxPackageDirsPattern } = await context.getSfdxProjectConfig();
    // const CONTENT_ASSET_GLOB_PATTERN = `${sfdxPackageDirsPattern}/**/contentassets/*.asset-meta.xml`;
    for (let i = 0; i < workspaceRoots.length; i = i + 1) {
        const sfdxProjectConfigs = await context.getSfdxProjectConfig();
        const CONTENT_ASSET_GLOB_PATTERN = `${sfdxProjectConfigs[i].sfdxPackageDirsPattern}/**/contentassets/*.asset-meta.xml`;
        const ws = workspaceRoots[i];
        try {
            const files: string[] = await glob(CONTENT_ASSET_GLOB_PATTERN, { cwd: ws });
            for (const file of files) {
                CONTENT_ASSETS.add(getResourceName(file));
            }
            return processContentAssets(ws, writeConfigs);
        } catch (err) {
            console.log(`Error queuing up indexing of content resources. Error details:`, err);
            throw err;
        }
    }
}

function generateTypeDeclarations(): string {
    let resTypeDecs = '';
    const sortedContentAssets = Array.from(CONTENT_ASSETS).sort();
    sortedContentAssets.forEach(res => {
        resTypeDecs += generateTypeDeclaration(res);
    });
    return resTypeDecs;
}

function generateTypeDeclaration(resourceName: string) {
    const result = `declare module "@salesforce/contentAssetUrl/${resourceName}" {
    var ${resourceName}: string;
    export default ${resourceName};
}
`;
    return result;
}
