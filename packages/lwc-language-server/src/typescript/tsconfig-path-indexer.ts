import * as path from 'path';
import * as fs from 'fs-extra';
import { shared } from '@salesforce/lightning-lsp-common';
import { sync } from 'fast-glob';
import normalize from 'normalize-path';
import { TextDocument } from 'vscode-languageserver';
import { URI } from 'vscode-uri';
import { collectImportsForDocument } from './imports';

const { detectWorkspaceType, WorkspaceType } = shared;
const REGEX_PATTERN = /\/core\/(.+?)\/modules\/(.+?)\/(.+?)\//;

type TSConfigPathItemAttribute = {
    readonly tsPath: string;
    readonly filePath: string;
};

// An internal object representing a path mapping for tsconfig.json file on core
class TSConfigPathItem {
    // internal typescript path mapping, e.g., "ui-force-components/modules/force/wireUtils/wireUtils"
    readonly tsPath: string;
    // actual file path for the ts file
    readonly filePath: string;

    constructor(attribute: TSConfigPathItemAttribute) {
        this.tsPath = attribute.tsPath;
        this.filePath = attribute.filePath;
    }
}

/**
 * An indexer that stores the TypeScript path mapping info on Core workspace.
 *
 * When using TypeScript for LWCs on core, tsconfig.json file's 'paths' attribute needs to be maintained so that
 * TypeScript compiler knows how to resolve imported LWC modules. This class maintains a mapping between LWCs
 * and their paths in tsconfig.json and automatically updates tsconfig.json file when initialized and when a LWC
 * TypeScript file is changed.
 *
 * This includes a map for all TypeScript LWCs on core, the key is a component's full name (namespace/cmpName)
 * and the value is an object that contains info on how this component should be mapped to in tsconfig.json
 * so that TypeScript can find the component on the file system.
 */
export default class TSConfigPathIndexer {
    readonly coreModulesWithTSConfig: string[];
    readonly workspaceType: number;
    // the root path for core directory
    readonly coreRoot: string;
    // A map for all TypeScript LWCs on core
    pathMapping: Map<string, TSConfigPathItem> = new Map<string, TSConfigPathItem>();

    constructor(workspaceRoots: string[]) {
        this.workspaceType = detectWorkspaceType(workspaceRoots);
        switch (this.workspaceType) {
            case WorkspaceType.CORE_ALL:
                this.coreRoot = workspaceRoots[0];
                const dirs = fs.readdirSync(this.coreRoot);
                const subdirs: string[] = [];
                for (const file of dirs) {
                    const subdir = path.join(this.coreRoot, file);
                    if (fs.statSync(subdir).isDirectory()) {
                        subdirs.push(subdir);
                    }
                }
                this.coreModulesWithTSConfig = this.getCoreModulesWithTSConfig(subdirs);
                break;
            case WorkspaceType.CORE_PARTIAL:
                this.coreRoot = path.join(workspaceRoots[0], '..');
                this.coreModulesWithTSConfig = this.getCoreModulesWithTSConfig(workspaceRoots);
                break;
        }
    }

    /**
     * Gets all paths for TypeScript LWC components on core.
     */
    get componentEntries(): string[] {
        const defaultSource = normalize(`${this.coreRoot}/*/modules/*/*/*.ts`);
        const files = sync(defaultSource);
        return files.filter((item: string): boolean => {
            const data = path.parse(item);
            let cmpName = data.name;
            // remove '.d' for any '.d.ts' files
            if (cmpName.endsWith('.d')) {
                cmpName = cmpName.replace('.d', '');
            }
            return data.dir.endsWith(cmpName);
        });
    }

    /**
     * Initialization: build the path mapping for Core workspace.
     */
    public async init(): Promise<void> {
        if (!this.isOnCore()) {
            return; // no-op if this is not a Core workspace
        }
        this.componentEntries.forEach(entry => {
            this.addNewPathMapping(entry);
        });
        // update each project under the workspaceRoots

        for (const workspaceRoot of this.coreModulesWithTSConfig) {
            await this.updateTSConfigPaths(workspaceRoot);
        }
    }

    /**
     * Given a typescript document, update its containing module's tsconfig.json file's paths attribute.
     * @param document the specified TS document
     */
    public async updateTSConfigFileForDocument(document: TextDocument): Promise<void> {
        if (!this.isOnCore()) {
            return; // no-op if this is not a Core workspace
        }
        const filePath = URI.file(document.uri).fsPath;
        this.addNewPathMapping(filePath);
        const moduleName = this.getModuleName(filePath);
        const projectRoot = this.getProjectRoot(filePath);
        const mappings = this.getTSMappingsForModule(moduleName);
        // add mappings for all imported LWCs
        const imports = await collectImportsForDocument(document);
        if (imports.size > 0) {
            for (const importee of imports) {
                const isInSameModule = this.moduleContainsNS(projectRoot, importee.substring(0, importee.indexOf('/')));
                const tsPath = this.pathMapping.get(importee)?.tsPath;
                if (tsPath) {
                    mappings.set(importee, this.getRelativeTSPath(tsPath, isInSameModule));
                }
            }
        }
        const tsconfigFile = path.join(projectRoot, 'tsconfig.json');
        this.updateTSConfigFile(tsconfigFile, mappings, false);
    }

    /**
     * @param coreModules A list of core modules root paths
     * @returns A sublist of core modules from input that has a tsconfig.json file
     */
    private getCoreModulesWithTSConfig(coreModules: string[]): string[] {
        const modules = [];
        for (const module of coreModules) {
            if (fs.existsSync(path.join(module, 'tsconfig.json'))) {
                modules.push(module);
            }
        }
        return modules;
    }

    /**
     * Update the tsconfig.json file for one module(project) in core.
     * Note that this only updates the path for all TypeScript LWCs within the module.
     * This does not analyze any imported LWCs outside of the module.
     * @param projectRoot the core module(project)'s root path, e.g., 'core-workspace/core/ui-force-components'
     */
    private async updateTSConfigPaths(projectRoot: string): Promise<void> {
        const tsconfigFile = path.join(projectRoot, 'tsconfig.json');
        const moduleName = path.basename(projectRoot);
        const mappings = this.getTSMappingsForModule(moduleName);
        await this.updateTSConfigFile(tsconfigFile, mappings, true);
    }

    /**
     * Update tsconfig.json file with updated mapping.
     * @param tsconfigFile target tsconfig.json file path
     * @param mapping updated map that contains path info to update
     * @param isReIndex true if the deleted existing paths should be removed
     */
    private async updateTSConfigFile(tsconfigFile: string, mapping: Map<string, string>, isReIndex: boolean): Promise<void> {
        if (!fs.pathExistsSync(tsconfigFile)) {
            return; // file does not exist, no-op
        }
        try {
            const tsconfigString = await fs.readFile(tsconfigFile, 'utf8');
            // remove any trailing commas
            const tsconfig = JSON.parse(tsconfigString.replace(/,([ |\t|\n]+[\}|\]|\)])/g, '$1'));
            if (tsconfig?.compilerOptions?.paths) {
                const formattedMapping = new Map<string, string[]>();
                mapping.forEach((value, key) => {
                    formattedMapping.set(key, [value]);
                });
                const existingPaths = tsconfig.compilerOptions.paths;
                const updatedPaths = { ...existingPaths };
                let updated = false;
                // remove the existing paths that are not in the updated mapping
                if (isReIndex) {
                    const projectRoot = path.join(tsconfigFile, '..');
                    for (const key in existingPaths) {
                        if (!formattedMapping.has(key) && this.moduleContainsNS(projectRoot, key.substring(0, key.indexOf('/')))) {
                            updated = true;
                            delete updatedPaths[key];
                        }
                    }
                }
                formattedMapping.forEach((value, key) => {
                    if (!existingPaths[key] || existingPaths[key][0] !== value[0]) {
                        updated = true;
                        updatedPaths[key] = value;
                    }
                });
                // only update tsconfig.json if any path mapping is updated
                if (!updated) {
                    return;
                }
                // sort the path mappings before update the file
                const sortedKeys = Object.keys(updatedPaths).sort();
                const sortedPaths: Record<string, string[]> = {};
                sortedKeys.forEach(key => {
                    sortedPaths[key] = updatedPaths[key];
                });
                tsconfig.compilerOptions.paths = sortedPaths;
                fs.writeJSONSync(tsconfigFile, tsconfig, {
                    spaces: 4,
                });
            }
        } catch (error) {
            console.warn(`Error updating core tsconfig. Continuing, but may be missing some config. ${error}`);
        }
    }

    /**
     * Get all the path mapping info for a given module name, e.g., 'ui-force-components'.
     * @param moduleName a target module's name
     */
    private getTSMappingsForModule(moduleName: string): Map<string, string> {
        const mappings = new Map<string, string>();
        this.pathMapping.forEach((value, key) => {
            if (value.filePath.includes(moduleName)) {
                mappings.set(key, this.getRelativeTSPath(value.tsPath, true));
            }
        });
        return mappings;
    }

    /**
     * Add a mapping for a TypeScript LWC file path. The file can be .ts or .d.ts.
     * @param entry file path for a TypeScript LWC ts file,
     *              e.g., 'core-workspace/core/ui-force-components/modules/force/wireUtils/wireUtils.d.ts'
     */
    private addNewPathMapping(entry: string): void {
        const componentFullName = this.getComponentFullName(entry);
        const tsPath = this.getTSPath(entry);
        if (componentFullName && tsPath) {
            this.pathMapping.set(componentFullName, new TSConfigPathItem({ tsPath, filePath: entry }));
        }
    }

    /**
     * @param entry file path, e.g., 'core-workspace/core/ui-force-components/modules/force/wireUtils/wireUtils.d.ts'
     * @returns component's full name, e.g., 'force/wireUtils'
     */
    private getComponentFullName(entry: string): string {
        const match = REGEX_PATTERN.exec(entry);
        return match && match[2] + '/' + match[3];
    }

    /**
     * @param entry file path, e.g., 'core-workspace/core/ui-force-components/modules/force/wireUtils/wireUtils.d.ts'
     * @returns component name, e.g., 'wireUtils'
     */
    private getComponentName(entry: string): string {
        const match = REGEX_PATTERN.exec(entry);
        return match && match[3];
    }

    /**
     * @param entry file path, e.g., 'core-workspace/core/ui-force-components/modules/force/wireUtils/wireUtils.d.ts'
     * @returns module (project) name, e.g., 'ui-force-components'
     */
    private getModuleName(entry: string): string {
        const match = REGEX_PATTERN.exec(entry);
        return match && match[1];
    }

    /**
     * @param entry file path, e.g., 'core-workspace/core/ui-force-components/modules/force/wireUtils/wireUtils.d.ts'
     * @returns module (project) name, e.g., 'ui-force-components'
     */
    private getProjectRoot(entry: string): string {
        const moduleName = this.getModuleName(entry);
        if (moduleName) {
            return path.join(this.coreRoot, moduleName);
        }
    }

    /**
     * @param entry file path, e.g., 'core-workspace/core/ui-force-components/modules/force/wireUtils/wireUtils.d.ts'
     * @returns internal representation of a path mapping, e.g., 'ui-force-components/modules/force/wireUtils/wireUtils'
     */
    private getTSPath(entry: string): string {
        const moduleName = this.getModuleName(entry);
        const componentName = this.getComponentName(entry);
        const componentFullName = this.getComponentFullName(entry);
        if (moduleName && componentName && componentFullName) {
            return `${moduleName}/modules/${componentFullName}/${componentName}`;
        } else {
            return null;
        }
    }

    /**
     * @param tsPath internal representation of a path mapping, e.g., 'ui-force-components/modules/force/wireUtils/wireUtils'
     * @param isInSameModule whether this path mapping is used for the same module
     * @returns a relative path for the mapping in tsconfig.json, e.g., './modules/force/wireUtils/wireUtils'
     */
    private getRelativeTSPath(tsPath: string, isInSameModule: boolean): string {
        return isInSameModule ? './' + tsPath.substring(tsPath.indexOf('/') + 1) : '../' + tsPath;
    }

    /**
     * @returns true if this is a core workspace; false otherwise.
     */
    private isOnCore(): boolean {
        return this.workspaceType === WorkspaceType.CORE_ALL || this.workspaceType === WorkspaceType.CORE_PARTIAL;
    }

    /**
     * Checks if a given namespace exists in a given module path.
     */
    private moduleContainsNS(modulePath: string, nsName: string): boolean {
        return fs.pathExistsSync(path.join(modulePath, 'modules', nsName));
    }
}
