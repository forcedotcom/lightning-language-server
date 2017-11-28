import { parse, join } from 'path';
import { Glob } from "glob";
import { write } from "./file-flush-util";
import { FileEvent, FileChangeType } from 'vscode-languageserver/lib/main';

const STATIC_RESOURCE_DECLARATION_FILE = "typings/staticresources.d.ts";
const STATIC_RESOURCE_GLOB_PATTERN = "**/staticresources/*.resource";
const STATIC_RESOURCES: Set<string> = new Set();

function getResourceName(resourceFile: string) {
    return parse(resourceFile).name;
}

export async function updateStaticResourceIndex(workspace: string, updatedFiles: FileEvent[]) {
    let didChange = false;
    updatedFiles.forEach(f => {
        if (f.uri.endsWith(".resource")) {
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
        await processStaticResources(workspace);
    }
}

async function processStaticResources(workspace: string) {
    if (STATIC_RESOURCES.size > 0) {
        await write(join(workspace, STATIC_RESOURCE_DECLARATION_FILE), generateResourceTypeDeclarations);
    }
}

export function indexStaticResources(workspacePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
        /* tslint:disable */
        new Glob(STATIC_RESOURCE_GLOB_PATTERN, {cwd: workspacePath}, async (err: Error, files: string[]) => {
            if (err) {
                console.log(`Error queing up indexing of static resources.Error detatils: ${err}`);
                reject(err);
            } else {
                files.map((file: string) => {
                    STATIC_RESOURCES.add(getResourceName(file));
                });
                await processStaticResources(workspacePath);
                resolve();
            }
        });
        /* tslint:enable */
    });
}

function generateResourceTypeDeclarations(): string {
    let resTypeDecs = "";
    STATIC_RESOURCES.forEach(res => {
        resTypeDecs += generateResourceTypeDeclaration(res);
    });
    return resTypeDecs;
}

function generateResourceTypeDeclaration(resourceName: string) {
    const result =
        `declare module "@resource-url/${resourceName}" {
    var resourceUrl: string;
    export default resourceUrl;
}
`;
    return result;
}
