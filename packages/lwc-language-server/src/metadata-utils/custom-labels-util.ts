import { Glob } from 'glob';
import * as fs from 'fs-extra';
import { join } from 'path';
import { parseString as parseStringSync, OptionsV2, convertableToString } from 'xml2js';
import { FileEvent, FileChangeType, Files } from 'vscode-languageserver';
import { WorkspaceContext } from 'lightning-lsp-common';
import { promisify } from 'util';
import { readFile } from 'fs-extra';

const glob = promisify(Glob);

interface ICustomLabelsResult {
    CustomLabels: ICustomLabels;
}
interface ICustomLabels {
    labels: ILabel[];
}
interface ILabel {
    fullName: string[];
}

const CUSTOM_LABELS: Set<string> = new Set();
const CUSTOM_LABEL_FILES: Set<string> = new Set();
const CUSTOM_LABELS_DECLARATION_FILE = '.sfdx/typings/lwc/customlabels.d.ts';

function parseString(xml: convertableToString, options?: OptionsV2): Promise<any> {
    return new Promise((resolve, reject) => {
        if (options) {
            parseStringSync(xml, options, (err, results) => {
                if (err) {
                    reject(err);
                }
                resolve(results);
            });
        } else {
            parseStringSync(xml, (err, results) => {
                if (err) {
                    reject(err);
                }
                resolve(results);
            });
        }
    });
}

export function resetCustomLabels() {
    CUSTOM_LABELS.clear();
    CUSTOM_LABEL_FILES.clear();
}

export async function indexCustomLabels(context: WorkspaceContext, writeConfigs: boolean = true): Promise<void> {
    const { workspaceRoots } = context;
    // const { sfdxPackageDirsPattern } = await context.getSfdxProjectConfig();
    // const CUSTOM_LABEL_GLOB_PATTERN = `${sfdxPackageDirsPattern}/**/labels/CustomLabels.labels-meta.xml`;
    for (let i = 0; i < workspaceRoots.length; i = i + 1) {
        const ws = workspaceRoots[i];
        const sfdxProjectConfigs = await context.getSfdxProjectConfig();
        const CUSTOM_LABEL_GLOB_PATTERN = `${sfdxProjectConfigs[i].sfdxPackageDirsPattern}/**/labels/CustomLabels.labels-meta.xml`;
        try {
            const files: string[] = await glob(CUSTOM_LABEL_GLOB_PATTERN, { cwd: ws });
            for (const file of files) {
                CUSTOM_LABEL_FILES.add(join(ws, file));
            }
            return processLabels(ws, writeConfigs);
        } catch (err) {
            console.log(`Error queuing up indexing of labels. Error details:`, err);
            throw err;
        }
    }
}

export async function updateLabelsIndex(updatedFiles: FileEvent[], { workspaceRoots }: WorkspaceContext, writeConfigs: boolean = true) {
    let didChange = false;
    for (const f of updatedFiles) {
        if (f.uri.endsWith('CustomLabels.labels-meta.xml')) {
            didChange = true;
            if (f.type === FileChangeType.Created) {
                CUSTOM_LABEL_FILES.add(Files.uriToFilePath(f.uri));
            } else if (f.type === FileChangeType.Deleted) {
                CUSTOM_LABEL_FILES.delete(Files.uriToFilePath(f.uri));
            }
        }
    }
    if (didChange) {
        for (const ws of workspaceRoots) {
            await processLabels(ws, writeConfigs);
        }
    }
}

async function processLabels(workspacePath: string, writeConfigs: boolean): Promise<void> {
    CUSTOM_LABELS.clear();
    if (writeConfigs) {
        const labelReadPromises: Array<Promise<void>> = [];

        for (const filePath of CUSTOM_LABEL_FILES) {
            labelReadPromises.push(readLabelFile(filePath));
        }

        await Promise.all(labelReadPromises);
        if (CUSTOM_LABELS.size > 0) {
            return fs.writeFile(join(workspacePath, CUSTOM_LABELS_DECLARATION_FILE), generateLabelTypeDeclarations());
        }
    }
}

async function readLabelFile(filePath: string) {
    try {
        const data = await readFile(filePath, 'utf-8');
        const result: ICustomLabelsResult = await parseString(data);
        for (const l of result.CustomLabels.labels) {
            if (l.fullName.length > 0) {
                CUSTOM_LABELS.add(l.fullName[0]);
            }
        }
    } catch (err) {
        console.log(`Error reading/parsing label file at ${filePath}. Error detatils:`, err);
    }
}

function generateLabelTypeDeclarations(): string {
    let resTypeDecs = '';
    const sortedCustomLabels = Array.from(CUSTOM_LABELS).sort();
    for (const res of sortedCustomLabels) {
        resTypeDecs += generateLabelTypeDeclaration(res);
    }
    return resTypeDecs;
}

function generateLabelTypeDeclaration(labelName: string) {
    const ns = 'c';
    const result = `declare module "@salesforce/label/${ns}.${labelName}" {
    var ${labelName}: string;
    export default ${labelName};
}
`;
    return result;
}
