import * as path from 'path'; // is this ok?
import * as fs from 'fs-extra';
import { WorkspaceContext, shared, utils, componentUtil } from '@salesforce/lightning-lsp-common';
import { readJsonSync, writeJsonSync } from 'lightning-lsp-common/lib/utils';
import equal from 'deep-equal';

const { WorkspaceType } = shared;

// file ==> add to jsconfig.json "paths" {tag, [relativePath]}, see http://www.typescriptlang.org/docs/handbook/module-resolution.html

export interface IPaths {
    [tag: string]: string[];
}
export interface IJsconfig {
    compilerOptions: {
        baseUrl?: string;
        paths?: IPaths;
    };
}
export async function onIndexCustomComponents(context: WorkspaceContext, files: string[]) {
    // set paths for all current components in all the projects jsconfig.json files
    for (const modulesDir of await context.getModulesDirs()) {
        const paths: IPaths = {};
        for (const file of files) {
            const tag = componentUtil.moduleFromFile(file, context.type === WorkspaceType.SFDX);
            // path must be relative to location of jsconfig.json
            const relativeFilePath = utils.relativePath(modulesDir, file);
            paths[tag] = [relativeFilePath];
        }

        // set "paths" in jsconfig.json
        const jsconfigFile = path.join(modulesDir, 'jsconfig.json');
        try {
            // note, this read/write file must be synchronous, so it is atomic
            const jsconfig: IJsconfig = readJsonSync(jsconfigFile);
            // deep clone of jsconfig created for update comparison
            const newJsconfig: IJsconfig = JSON.parse(JSON.stringify(jsconfig));
            if (
                !jsconfig.compilerOptions ||
                !jsconfig.compilerOptions.hasOwnProperty('baseUrl') ||
                jsconfig.compilerOptions.baseUrl !== '.' ||
                !jsconfig.compilerOptions.hasOwnProperty('paths') ||
                JSON.stringify(jsconfig.compilerOptions.paths) !== JSON.stringify(paths)
            ) {
                if (!jsconfig.compilerOptions) {
                    newJsconfig.compilerOptions = {};
                }
                newJsconfig.compilerOptions.baseUrl = '.';
                newJsconfig.compilerOptions.paths = paths;

                if (!equal(jsconfig, newJsconfig)) {
                    writeJsonSync(jsconfigFile, newJsconfig);
                }
            }
        } catch (err) {
            console.log(`onIndexCustomComponents(LOTS): Error reading jsconfig ${jsconfigFile}`, err);
        }
    }
}

export async function onSetCustomComponent(context: WorkspaceContext, file: string): Promise<void> {
    if (!file) {
        // could be a non-local tag, like LGC, etc
        return;
    }
    // add tag/path to component to all the project's jsconfig.json "paths"
    const moduleTag = componentUtil.moduleFromFile(file, context.type === WorkspaceType.SFDX);
    for (const modulesDir of await context.getModulesDirs()) {
        const relativeFilePath = utils.relativePath(modulesDir, file);
        const jsconfigFile = path.join(modulesDir, 'jsconfig.json');
        try {
            // note, this read/write file must be synchronous, so it is atomic
            const jsconfig: IJsconfig = readJsonSync(jsconfigFile);
            // deep clone of jsconfig created for update comparison
            const newJsconfig: IJsconfig = JSON.parse(JSON.stringify(jsconfig));
            if (!jsconfig.compilerOptions) {
                newJsconfig.compilerOptions = {};
            }

            if (!jsconfig.compilerOptions.paths) {
                newJsconfig.compilerOptions.paths = {};
            }

            newJsconfig.compilerOptions.baseUrl = '.';
            newJsconfig.compilerOptions.paths[moduleTag] = [relativeFilePath];

            if (!equal(jsconfig, newJsconfig)) {
                writeJsonSync(jsconfigFile, newJsconfig);
            }
        } catch (err) {
            console.log(`onCreatedCustomComponent(${file}): Error reading jsconfig ${jsconfigFile}`, err);
        }
    }
}

export async function onDeletedCustomComponent(moduleTag: string, context: WorkspaceContext): Promise<void> {
    // delete tag from all the project's jsconfig.json "paths"
    for (const modulesDir of await context.getModulesDirs()) {
        const jsconfigFile = path.join(modulesDir, 'jsconfig.json');
        try {
            // note, this read/write file must be synchronous, so it is atomic
            const jsconfig: IJsconfig = readJsonSync(jsconfigFile);
            if (jsconfig.compilerOptions) {
                if (jsconfig.compilerOptions.paths) {
                    delete jsconfig.compilerOptions.paths[moduleTag];
                    writeJsonSync(jsconfigFile, jsconfig);
                }
            }
        } catch (err) {
            console.log(`onDeletedCustomComponent${moduleTag}: Error reading jsconfig ${jsconfigFile}`, err);
        }
    }
}
