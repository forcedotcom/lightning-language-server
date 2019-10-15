// TODO: make this more generic and reuse code for static resources and this
import { parse, join } from 'path';
import { Glob } from 'glob';
import { FileEvent, FileChangeType } from 'vscode-languageserver';
import { WorkspaceContext } from 'lightning-lsp-common';
import { promisify } from 'util';
import * as fs from 'fs-extra';

const glob = promisify(Glob);

const MESSAGE_CHANNEL_DECLARATION_FILE = '.sfdx/typings/lwc/messagechannels.d.ts';
const MESSAGE_CHANNELS: Set<string> = new Set();

export function resetMessageChannels() {
    MESSAGE_CHANNELS.clear();
}

function getResourceName(resourceMetaFile: string) {
    const resourceFile = resourceMetaFile.substring(0, resourceMetaFile.lastIndexOf('-'));
    return parse(resourceFile).name;
}

export async function updateMessageChannelsIndex(updatedFiles: FileEvent[], { workspaceRoot }: WorkspaceContext, writeConfigs: boolean = true) {
    let didChange = false;
    for (const f of updatedFiles) {
        if (f.uri.endsWith('.messageChannel-meta.xml')) {
            if (f.type === FileChangeType.Created) {
                didChange = true;
                MESSAGE_CHANNELS.add(getResourceName(f.uri));
            } else if (f.type === FileChangeType.Deleted) {
                MESSAGE_CHANNELS.delete(getResourceName(f.uri));
                didChange = true;
            }
        }
    }
    if (didChange) {
        return processMessageChannels(workspaceRoot, writeConfigs);
    }
}

export async function indexMessageChannels(context: WorkspaceContext, writeConfigs: boolean): Promise<void> {
    const { workspaceRoot } = context;
    const { sfdxPackageDirsPattern } = await context.getSfdxProjectConfig();
    const MESSAGE_CHANNEL_GLOB_PATTERN = `${sfdxPackageDirsPattern}/**/messageChannels/*.messageChannel-meta.xml`;

    try {
        const files: string[] = await glob(MESSAGE_CHANNEL_GLOB_PATTERN, { cwd: workspaceRoot });
        for (const file of files) {
            MESSAGE_CHANNELS.add(getResourceName(file));
        }
        return processMessageChannels(workspaceRoot, writeConfigs);
    } catch (err) {
        console.log(`Error queuing up indexing of content resources. Error details:`, err);
        throw err;
    }
}

function processMessageChannels(workspace: string, writeConfig: boolean): Promise<void> {
    if (MESSAGE_CHANNELS.size > 0 && writeConfig) {
        return fs.writeFile(join(workspace, MESSAGE_CHANNEL_DECLARATION_FILE), generateTypeDeclarations());
    }
}

function generateTypeDeclarations(): string {
    let resTypeDecs = '';
    const sortedContentAssets = Array.from(MESSAGE_CHANNELS).sort();
    sortedContentAssets.forEach(res => {
        resTypeDecs += generateTypeDeclaration(res);
    });
    return resTypeDecs;
}

function generateTypeDeclaration(resourceName: string) {
    const result = `declare module "@salesforce/messageChannel/${resourceName}__c" {
    var ${resourceName}: string;
    export default ${resourceName};
}
`;
    return result;
}
