import { WorkspaceContext } from './context';
import { tagFromFile } from './metadata-utils/custom-components-util';
import { WorkspaceType } from './shared';
import * as utils from './utils';
import * as path from 'path';

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

export function onIndexCustomComponents(context: WorkspaceContext, files: string[]) {
    // set paths for all current components in all the projects jsconfig.json files
    context.getRelativeModulesDirs().forEach(relativeModulesDir => {
        const modulesDir = path.join(context.workspaceRoot, relativeModulesDir);

        const paths: IPaths = {};
        for (const file of files) {
            const tag = tagFromFile(file, context.type === WorkspaceType.SFDX);
            // path must be relative to location of jsconfig.json
            const relativeFilePath = utils.relativePath(modulesDir, file);
            paths[tag] = [relativeFilePath];
        }

        // set "paths" in jsconfig.json
        const relativeJsConfigPath = path.join(relativeModulesDir, 'jsconfig.json');
        const jsconfigFile = path.join(context.workspaceRoot, relativeJsConfigPath);
        const jsconfig: IJsconfig = JSON.parse(utils.readFileSync(jsconfigFile));
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
            writeJsconfig(jsconfigFile, jsconfig);
        }
    });
}

export function onCreatedCustomComponent(context: WorkspaceContext, file: string) {
    // add tag/path to component to all the project's jsconfig.json "paths"
    const tag = tagFromFile(file, context.type === WorkspaceType.SFDX);
    context.getRelativeModulesDirs().forEach(relativeModulesDir => {
        const modulesDir = path.join(context.workspaceRoot, relativeModulesDir);

        // path must be relative to location of jsconfig.json
        const relativeFilePath = utils.relativePath(modulesDir, file);

        // update "paths" in jsconfig.json
        const relativeJsConfigPath = path.join(relativeModulesDir, 'jsconfig.json');
        const jsconfigFile = path.join(context.workspaceRoot, relativeJsConfigPath);
        const jsconfig: IJsconfig = JSON.parse(utils.readFileSync(jsconfigFile));
        if (!jsconfig.compilerOptions) {
            jsconfig.compilerOptions = {};
        }
        jsconfig.compilerOptions.baseUrl = '.';
        if (!jsconfig.compilerOptions.paths) {
            jsconfig.compilerOptions.paths = {};
        }
        jsconfig.compilerOptions.paths[tag] = [relativeFilePath];
        writeJsconfig(jsconfigFile, jsconfig);
    });
}

export function onDeletedCustomComponent(context: WorkspaceContext, file: string) {
    // delete tag from all the project's jsconfig.json "paths"
    const tag = tagFromFile(file, context.type === WorkspaceType.SFDX);
    context.getRelativeModulesDirs().forEach(relativeModulesDir => {
        const relativeJsConfigPath = path.join(relativeModulesDir, 'jsconfig.json');
        const jsconfigFile = path.join(context.workspaceRoot, relativeJsConfigPath);
        const jsconfig: IJsconfig = JSON.parse(utils.readFileSync(jsconfigFile));
        if (jsconfig.compilerOptions) {
            if (jsconfig.compilerOptions.paths) {
                delete jsconfig.compilerOptions.paths[tag];
                writeJsconfig(jsconfigFile, jsconfig);
            }
        }
    });
}

export function writeJsconfig(file: string, jsconfig: {}) {
    utils.writeFileSync(file, JSON.stringify(jsconfig, null, 4));
}
