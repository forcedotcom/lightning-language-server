import { Glob } from "glob";
import { readFile } from "fs";
import { parseString } from "xml2js";
import { enqueueFlush } from "./file-flush-util";

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
const CUSTOM_LABELS_DECLARATION_FILE = "typings/customlabels.d.ts";
const CUSTOM_LABEL_GLOB_PATTERN = "**/labels/CustomLabels.labels-meta.xml";

export function indexCustomLabels() {
    /* tslint:disable */
    new Glob(CUSTOM_LABEL_GLOB_PATTERN, (err: Error, files: string[]) => {
        if (err) {
            console.log(`Error queing up indexing of labels.
            Error detatils: ${err}`);
        } else {
            processLabelFiles(files);
        }
    });
   /* tslint:enable */
}

export function addLabelsFile(filePath: string) {
    CUSTOM_LABEL_FILES.add(filePath);
}

export function removeLabelsFile(filePath: string) {
    CUSTOM_LABEL_FILES.delete(filePath);
}

function processLabelFiles(files: string[]) {
    files.forEach(file => {
        addLabelsFile(file);
    });
    writeLabelTypeDeclarations();
}

export async function writeLabelTypeDeclarations() {
    CUSTOM_LABELS.clear();
    await readLabelFiles();
    if (CUSTOM_LABELS.size > 0) {
        enqueueFlush(CUSTOM_LABELS_DECLARATION_FILE, generateLabelTypeDeclarations);
    }
}

function readLabelFiles() {
    const labelReadPromises: Array<Promise<void>> = [];
    CUSTOM_LABEL_FILES.forEach(filePath => {
        labelReadPromises.push(readLabelFile(filePath));
    });
    return Promise.all(labelReadPromises);
}

function readLabelFile(filePath: string) {
    return new Promise<void>(resolve => {
        readFile(filePath, (err, data) => {
            if (err) {
                console.log(`Error reading label file at ${filePath}.
                Error detatils: ${err}`);
                // if we can't read the file, let's just proceed without it.
                resolve();
            } else {
                parseString(data, (parseErr, result: ICustomLabelsResult) => {
                    if (parseErr) {
                        // if we can't parse the file, let's just proceed without it.
                        console.log(`Error parsing the contents of label file at ${filePath}.
                        Error detatils: ${parseErr}`);
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
    let resTypeDecs = "";
    CUSTOM_LABELS.forEach( res => {
        resTypeDecs += generateLabelTypeDeclaration(res);
    });
    return resTypeDecs;
}

function generateLabelTypeDeclaration(labelName: string) {
    const ns = "c";
    const result =
`declare module "@label/${ns}/${labelName}" {
    var labelName: string;
    export default labelName;
}
`;
    return result;
}
