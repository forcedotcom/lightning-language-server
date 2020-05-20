// TODO: make this more generic and reuse code for static resources and this
import { parse, join } from 'path';
import { Glob } from 'glob';
import { FileEvent, FileChangeType } from 'vscode-languageserver';
import { WorkspaceContext } from '@salesforce/lightning-lsp-common';
import { promisify } from 'util';
import * as fs from 'fs-extra';

const glob = promisify(Glob);

const CONTENT_ASSET_DECLARATION_FILE = '.sfdx/typings/lwc/contentassets.d.ts';
const CONTENT_ASSET_INDEX_FILE = '.sfdx/indexes/lwc/contentassets.json';
let CONTENT_ASSETS: Set<string> = new Set();

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
        return processContentAssets(workspaceRoots[0], writeConfigs);
    }
}

function processContentAssets(workspace: string, writeConfig: boolean): Promise<void> {
    if (CONTENT_ASSETS.size > 0 && writeConfig) {
        return fs.writeFile(join(workspace, CONTENT_ASSET_DECLARATION_FILE), generateTypeDeclarations());
    }
}

export async function indexContentAssets(context: WorkspaceContext, writeConfigs: boolean): Promise<void> {
    const { workspaceRoots } = context;
    const workspace: string = workspaceRoots[0];
    const { sfdxPackageDirsPattern } = await context.getSfdxProjectConfig();
    const CONTENT_ASSET_GLOB_PATTERN = `${sfdxPackageDirsPattern}/**/contentassets/*.asset-meta.xml`;

    try {
        initContentAssetsIndex(workspace);
        if (CONTENT_ASSETS) {
            return Promise.resolve();
        }
        const files: string[] = await glob(CONTENT_ASSET_GLOB_PATTERN, { cwd: workspaceRoots[0] });
        for (const file of files) {
            CONTENT_ASSETS.add(getResourceName(file));
        }
        return processContentAssets(workspaceRoots[0], writeConfigs);
    } catch (err) {
        console.log(`Error queuing up indexing of content resources. Error details:`, err);
        throw err;
    }
}

const generateTypeDeclarations = (): string =>
    Array.from(CONTENT_ASSETS)
        .sort()
        .map(generateTypeDeclaration)
        .join('');

const generateTypeDeclaration = (resourceName: string): string =>
    `declare module "@salesforce/contentAssetUrl/${resourceName}" {
    var ${resourceName}: string;
    export default ${resourceName};
}
`;

function initContentAssetsIndex(workspace: string) {
    const indexPath: string = join(workspace, CONTENT_ASSET_INDEX_FILE);
    const shouldInit: boolean = CONTENT_ASSETS.size === 0 && fs.existsSync(indexPath);

    if (shouldInit) {
        const indexJsonString: string = fs.readFileSync(indexPath, 'utf8');
        const staticIndex = JSON.parse(indexJsonString);
        CONTENT_ASSETS = new Set(staticIndex);
    }
}
export function persistContentAssets(context: WorkspaceContext) {
    const { workspaceRoots } = context;
    const indexPath = join(workspaceRoots[0], CONTENT_ASSET_INDEX_FILE);
    const index = Array.from(CONTENT_ASSETS);
    const indexJsonString = JSON.stringify(index);

    fs.writeFile(indexPath, indexJsonString);
}
