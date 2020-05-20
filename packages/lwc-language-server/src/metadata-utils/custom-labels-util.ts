import { Glob } from 'glob';
import * as fs from 'fs-extra';
import { join } from 'path';
import { parseString as parseStringSync, OptionsV2, convertableToString } from 'xml2js';
import { FileEvent, FileChangeType, Files } from 'vscode-languageserver';
import { WorkspaceContext } from '@salesforce/lightning-lsp-common';
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

let CUSTOM_LABELS: Set<string> = new Set();
const CUSTOM_LABEL_FILES: Set<string> = new Set();
const CUSTOM_LABELS_DECLARATION_FILE = '.sfdx/typings/lwc/customlabels.d.ts';
const CUSTOM_LABELS_INDEX_FILE = '.sfdx/indexes/lwc/customlabels.json';

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
    const workspace: string = workspaceRoots[0];
    const { sfdxPackageDirsPattern } = await context.getSfdxProjectConfig();
    const CUSTOM_LABEL_GLOB_PATTERN = `${sfdxPackageDirsPattern}/**/labels/CustomLabels.labels-meta.xml`;
    try {
        if (initCustomLabelsIndex(workspace)) {
            return Promise.resolve();
        }
        const files: string[] = await glob(CUSTOM_LABEL_GLOB_PATTERN, { cwd: workspaceRoots[0] });
        for (const file of files) {
            CUSTOM_LABEL_FILES.add(join(workspaceRoots[0], file));
        }
        return processLabels(workspaceRoots[0], writeConfigs);
    } catch (err) {
        console.log(`Error queuing up indexing of labels. Error details:`, err);
        throw err;
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
        await processLabels(workspaceRoots[0], writeConfigs);
    }
}

async function processLabels(workspacePath: string, writeConfigs: boolean): Promise<void> {
    CUSTOM_LABELS.clear();
    if (writeConfigs) {
        const labelReadPromises: Promise<void>[] = [];

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

const generateLabelTypeDeclarations = (): string =>
    Array.from(CUSTOM_LABELS)
        .sort()
        .map(generateLabelTypeDeclaration)
        .join('');

const generateLabelTypeDeclaration = (labelName: string): string =>
    `declare module "@salesforce/label/c.${labelName}" {
    var ${labelName}: string;
    export default ${labelName};
}
`;

function initCustomLabelsIndex(workspace: string): boolean {
    const indexPath: string = join(workspace, CUSTOM_LABELS_INDEX_FILE);
    const shouldInit: boolean = CUSTOM_LABELS.size === 0 && fs.existsSync(indexPath);

    if (shouldInit) {
        const indexJsonString: string = fs.readFileSync(indexPath, 'utf8');
        const staticIndex = JSON.parse(indexJsonString);
        CUSTOM_LABELS = new Set(staticIndex);
        return true;
    } else {
        return false;
    }
}
export function persistCustomLabels(context: WorkspaceContext) {
    const { workspaceRoots } = context;
    const indexPath = join(workspaceRoots[0], CUSTOM_LABELS_INDEX_FILE);
    const index = Array.from(CUSTOM_LABELS);
    const indexJsonString = JSON.stringify(index);

    fs.writeFile(indexPath, indexJsonString);
}
