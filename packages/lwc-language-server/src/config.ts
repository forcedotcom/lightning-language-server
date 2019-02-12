import * as path from 'path';
import { WorkspaceContext, shared, utils, componentUtil } from 'lightning-lsp-common';
import * as fs from 'fs-extra';
import retry from 'async-retry';

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

async function readJsonWithRetry(file: string): Promise<any> {
    return retry(async () => {
        const exists = await fs.pathExists(file);
        if (exists) {
            return fs.readJSON(file);
        }
        return {};
    }, {});
}

export async function onIndexCustomComponents(context: WorkspaceContext, files: string[]) {
    // set paths for all current components in all the projects jsconfig.json files
    for (const relativeModulesDir of await context.getRelativeModulesDirs()) {
        const modulesDir = path.join(context.workspaceRoot, relativeModulesDir);

        const paths: IPaths = {};
        for (const file of files) {
            const tag = componentUtil.moduleFromFile(file, context.type === WorkspaceType.SFDX);
            // path must be relative to location of jsconfig.json
            const relativeFilePath = utils.relativePath(modulesDir, file);
            paths[tag] = [relativeFilePath];
        }

        // set "paths" in jsconfig.json
        const relativeJsConfigPath = path.join(relativeModulesDir, 'jsconfig.json');
        const jsconfigFile = path.join(context.workspaceRoot, relativeJsConfigPath);
        try {
            const jsconfig: IJsconfig = await readJsonWithRetry(jsconfigFile);
            if (
                !jsconfig.compilerOptions ||
                !jsconfig.compilerOptions.hasOwnProperty('baseUrl') ||
                jsconfig.compilerOptions.baseUrl !== '.' ||
                !jsconfig.compilerOptions.hasOwnProperty('paths') ||
                JSON.stringify(jsconfig.compilerOptions.paths) !== JSON.stringify(paths)
            ) {
                if (!jsconfig.compilerOptions) {
                    jsconfig.compilerOptions = {};
                }
                jsconfig.compilerOptions.baseUrl = '.';
                jsconfig.compilerOptions.paths = paths;
                await writeJsconfig(jsconfigFile, jsconfig);
            }
        } catch (err) {
            console.log(`Error reading jsconfig ${jsconfigFile}`, err);
        }
    }
}

export async function onCreatedCustomComponent(context: WorkspaceContext, file: string): Promise<void> {
    if (!file) {
        // could be a non-local tag, like LGC, etc
        return;
    }
    // add tag/path to component to all the project's jsconfig.json "paths"
    const moduleTag = componentUtil.moduleFromFile(file, context.type === WorkspaceType.SFDX);
    for (const relativeModulesDir of await context.getRelativeModulesDirs()) {
        const modulesDir = path.join(context.workspaceRoot, relativeModulesDir);

        // path must be relative to location of jsconfig.json
        const relativeFilePath = utils.relativePath(modulesDir, file);

        // update "paths" in jsconfig.json
        const relativeJsConfigPath = path.join(relativeModulesDir, 'jsconfig.json');
        const jsconfigFile = path.join(context.workspaceRoot, relativeJsConfigPath);
        try {
            const jsconfig: IJsconfig = await readJsonWithRetry(jsconfigFile);
            if (!jsconfig.compilerOptions) {
                jsconfig.compilerOptions = {};
            }
            jsconfig.compilerOptions.baseUrl = '.';
            if (!jsconfig.compilerOptions.paths) {
                jsconfig.compilerOptions.paths = {};
            }
            jsconfig.compilerOptions.paths[moduleTag] = [relativeFilePath];
            await writeJsconfig(jsconfigFile, jsconfig);
        } catch (err) {
            console.log(`Error reading jsconfig ${jsconfigFile}`, err);
        }
    }
}

export async function onDeletedCustomComponent(moduleTag: string, context: WorkspaceContext): Promise<void> {
    // delete tag from all the project's jsconfig.json "paths"
    for (const relativeModulesDir of await context.getRelativeModulesDirs()) {
        const relativeJsConfigPath = path.join(relativeModulesDir, 'jsconfig.json');
        const jsconfigFile = path.join(context.workspaceRoot, relativeJsConfigPath);
        try {
            const jsconfig: IJsconfig = await readJsonWithRetry(jsconfigFile);
            if (jsconfig.compilerOptions) {
                if (jsconfig.compilerOptions.paths) {
                    delete jsconfig.compilerOptions.paths[moduleTag];
                    await writeJsconfig(jsconfigFile, jsconfig);
                }
            }
        } catch (err) {
            console.log(`Error reading jsconfig ${jsconfigFile}`, err);
        }
    }
}

export async function writeJsconfig(file: string, jsconfig: {}): Promise<void> {
    return fs.writeFile(file, JSON.stringify(jsconfig, null, 4));
}
