// TODO: make this more generic and reuse code for static resources and this
import { parse, join } from 'path';
import { Glob } from 'glob';
import { FileEvent, FileChangeType } from 'vscode-languageserver';
import { WorkspaceContext } from '../context';
import * as utils from '../utils';

const CONTENT_ASSET_DECLARATION_FILE = '.sfdx/typings/lwc/contentassets.d.ts';
const CONTENT_ASSETS: Set<string> = new Set();

export function resetContentAssets() {
    CONTENT_ASSETS.clear();
}

function getResourceName(resourceMetaFile: string) {
    const resourceFile = resourceMetaFile.substring(0, resourceMetaFile.lastIndexOf('-'));
    return parse(resourceFile).name;
}

export async function updateContentAssetIndex(updatedFiles: FileEvent[], { workspaceRoot }: WorkspaceContext) {
    let didChange = false;
    updatedFiles.forEach(f => {
        if (f.uri.endsWith('.asset-meta.xml')) {
            if (f.type === FileChangeType.Created) {
                didChange = true;
                CONTENT_ASSETS.add(getResourceName(f.uri));
            } else if (f.type === FileChangeType.Deleted) {
                CONTENT_ASSETS.delete(getResourceName(f.uri));
                didChange = true;
            }
        }
    });
    if (didChange) {
        processContentAssets(workspaceRoot);
    }
}

function processContentAssets(workspace: string) {
    if (CONTENT_ASSETS.size > 0) {
        utils.writeFileSync(join(workspace, CONTENT_ASSET_DECLARATION_FILE), generateTypeDeclarations());
    }
}

export function indexContentAssets(workspacePath: string, sfdxPackageDirsPattern: string): Promise<void> {
    const CONTENT_ASSET_GLOB_PATTERN = `${sfdxPackageDirsPattern}/**/contentassets/*.asset-meta.xml`;
    return new Promise((resolve, reject) => {
        /* tslint:disable */
        new Glob(CONTENT_ASSET_GLOB_PATTERN, { cwd: workspacePath }, async (err: Error, files: string[]) => {
            if (err) {
                console.log(`Error queueing up indexing of content assets. Error details: ${err}`);
                reject(err);
            } else {
                files.map((file: string) => {
                    CONTENT_ASSETS.add(getResourceName(file));
                });
                processContentAssets(workspacePath);
                resolve();
            }
        });
        /* tslint:enable */
    });
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
