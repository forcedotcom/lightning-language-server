import { Glob, IOptions } from 'glob';
import { readFile } from 'fs';
import { join } from 'path';
import { parseString } from 'xml2js';
import { write } from './file-flush-util';
import { FileEvent, FileChangeType, Files } from 'vscode-languageserver';
import { WorkspaceContext } from '../context';

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

function getGlob(globPattern: string, workspace: string, callBack: (err: Error, files: string[]) => void) {
    const options: IOptions = {};
    options.cwd = workspace;

    return new Glob(globPattern, options, callBack);
}

export function indexCustomLabels(workspacePath: string, sfdxPackageDirsPattern: string): Promise<void> {
    const CUSTOM_LABEL_GLOB_PATTERN = `${sfdxPackageDirsPattern}/**/labels/CustomLabels.labels-meta.xml`;
    return new Promise((resolve, reject) => {
        getGlob(CUSTOM_LABEL_GLOB_PATTERN, workspacePath, async (err: Error, files: string[]) => {
            if (err) {
                console.log(`Error queing up indexing of labels. Error detatils: ${err}`);
                reject(err);
            } else {
                try {
                    files.forEach(file => {
                        CUSTOM_LABEL_FILES.add(join(workspacePath, file));
                    });
                    await processLabels(workspacePath);
                    resolve();
                } catch (e) {
                    reject(e);
                }
            }
        });
    });
}

export async function updateLabelsIndex(updatedFiles: FileEvent[], { workspaceRoot }: WorkspaceContext) {
    let didChange = false;
    updatedFiles.forEach(f => {
        if (f.uri.endsWith('CustomLabels.labels-meta.xml')) {
            didChange = true;
            if (f.type === FileChangeType.Created) {
                CUSTOM_LABEL_FILES.add(Files.uriToFilePath(f.uri));
            } else if (f.type === FileChangeType.Deleted) {
                CUSTOM_LABEL_FILES.delete((Files.uriToFilePath(f.uri)));
            }
        }
    });
    if (didChange) {
        await processLabels(workspaceRoot);
    }
}

async function processLabels(workspacePath: string) {
    CUSTOM_LABELS.clear();
    const labelReadPromises: Array<Promise<void>> = [];

    CUSTOM_LABEL_FILES.forEach(filePath => {
        labelReadPromises.push(readLabelFile(filePath));
    });

    await Promise.all(labelReadPromises);
    if (CUSTOM_LABELS.size > 0) {
        await write(join(workspacePath, CUSTOM_LABELS_DECLARATION_FILE), generateLabelTypeDeclarations);
    }
}

function readLabelFile(filePath: string) {
    return new Promise<void>(resolve => {
        readFile(filePath, (err: NodeJS.ErrnoException, data: Buffer) => {
            if (err) {
                console.log(`Error reading label file at ${filePath}. Error detatils: ${err}`);
                // if we can't read the file, let's just proceed without it.
                resolve();
            } else {
                parseString(data, (parseErr: any, result: ICustomLabelsResult) => {
                    if (parseErr) {
                        // if we can't parse the file, let's just proceed without it.
                        console.log(
                            `Error parsing the contents of label file at ${filePath}. Error detatils: ${parseErr}`);
                        resolve();
                    } else {
                        result.CustomLabels.labels.map(l => {
                            if (l.fullName.length > 0) {
                                CUSTOM_LABELS.add(l.fullName[0]);
                            }
                        });
                        resolve();
                    }
                });
            }
        });
    });
}

function generateLabelTypeDeclarations(): string {
    let resTypeDecs = '';
    CUSTOM_LABELS.forEach(res => {
        resTypeDecs += generateLabelTypeDeclaration(res);
    });
    return resTypeDecs;
}

function generateLabelTypeDeclaration(labelName: string) {
    const ns = 'c';
    const result =
        `declare module "@label/${ns}.${labelName}" {
    var labelName: string;
    export default labelName;
}
`;
    return result;
}
