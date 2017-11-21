import { sep, parse } from 'path';
import { Glob } from "glob";
import { getlwcStandardResourcePath } from './../utils';
import * as fs from "fs";

export interface ITagInfo {
    attributes: string[];
}

const LWC_GLOB_PATTERN = "**/lightningcomponents/*/*.js";
export const LWC_TAGS: Map<string, ITagInfo> = new Map();

export function indexLwc() {
    loadStandardLwc();
    indexCustomComponents();
}

export function getLwcTags() {
    return LWC_TAGS.keys();
}

export function getLwcByTag(tagName: string) {
    return LWC_TAGS.get(tagName);
}

function loadStandardLwc() {
    const lwcStandard = JSON.parse(fs.readFileSync(getlwcStandardResourcePath(), 'utf8'));
    for (const property in lwcStandard) {
        if (lwcStandard.hasOwnProperty(property) && typeof property === 'string') {
            const val: ITagInfo = { attributes: [] };
            if (lwcStandard[property].attributes) {
                lwcStandard[property].attributes.map((a: any) => {
                    const attrName = a.name.replace(/([A-Z])/g, (match: string) => `-${match.toLowerCase()}`);
                    val.attributes.push(attrName);
                });
            }
            LWC_TAGS.set('lightning-' + property, val);
        }
    }
}

function addCustomTag(tag: string) {
        LWC_TAGS.set('c-' + tag, {attributes: []});
}
function removeCustomTag(tag: string) {
    LWC_TAGS.delete('c-' + tag);
}

function indexCustomComponents() {
    /* tslint:disable */
    new Glob(LWC_GLOB_PATTERN, (err: Error, files: string[]) => {
        if (err) {
            console.log(`Error queing up indexing of labels.
            Error detatils: ${err}`);
        } else {
            loadCustomTagsFromFiles(files);
        }
    });
   /* tslint:enable */
}

function loadCustomTagsFromFiles(filePaths: string[]) {
    filePaths.map((file: string) => {
        addCustomTagFromFile(file);
    });
}

export function addCustomTagFromFile(file: string) {
    const filePath = parse(file);
    const fileName = filePath.name;
    const parentDirName = filePath.dir.split(sep).pop();
    if (fileName === parentDirName) {
        addCustomTag(parentDirName);
    }
}

export function removeCustomTagFromFile(file: string) {
    const filePath = parse(file);
    const fileName = filePath.name;
    const parentDirName = filePath.dir.split(sep).pop();
    if (fileName === parentDirName) {
        removeCustomTag(parentDirName);
    }
}
