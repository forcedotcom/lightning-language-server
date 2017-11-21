import { parse } from 'path';
import { Glob } from "glob";
import { enqueueFlush } from "./file-flush-util";

const STATIC_RESOURCE_DECLARATION_FILE = "typings/staticresources.d.ts";
const STATIC_RESOURCE_GLOB_PATTERN = "**/staticresources/*.resource";
const STATIC_RESOURCES: Set<string> = new Set();

export function addStaticResource(resourceFile: string) {
    const filePath = parse(resourceFile);
    const resourceName = filePath.name;
    if (!STATIC_RESOURCES.has(resourceName)) {
        STATIC_RESOURCES.add(resourceName);
        enqueueFlush(STATIC_RESOURCE_DECLARATION_FILE, generateResourceTypeDeclarations);
    }
}

export function removeStaticResource(resourceFile: string) {
    const filePath = parse(resourceFile);
    const resourceName = filePath.name;
    if (STATIC_RESOURCES.delete(resourceName)) {
        enqueueFlush(STATIC_RESOURCE_DECLARATION_FILE, generateResourceTypeDeclarations);
    }
}

export function indexStaticResources() {
    /* tslint:disable */
    new Glob(STATIC_RESOURCE_GLOB_PATTERN, (err: Error, files: string[]) => {
        if (err) {
            console.log(`Error queing up indexing of static resources.
            Error detatils: ${err}`);
        } else {
            files.map((file: string) => {
                addStaticResource(file);
            });
        }
    });
    /* tslint:enable */
}

function generateResourceTypeDeclarations(): string {
    let resTypeDecs = "";
    STATIC_RESOURCES.forEach( res => {
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
