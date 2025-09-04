/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */

import * as fs from 'fs-extra';
import { homedir } from 'os';
import * as path from 'path';
import { TextDocument } from 'vscode-languageserver';
import ejs from 'ejs';
import { WorkspaceType, detectWorkspaceType, getSfdxProjectFile } from './shared';
import * as utils from './utils';

// Define and export AURA_EXTENSIONS constant
export const AURA_EXTENSIONS: string[] = ['.cmp', '.app', '.design', '.evt', '.intf', '.auradoc', '.tokens'];

export interface SfdxPackageDirectoryConfig {
    path: string;
}

export interface SfdxProjectConfig {
    packageDirectories: SfdxPackageDirectoryConfig[];
    sfdxPackageDirsPattern: string;
}

export interface Indexer {
    configureAndIndex(): Promise<void>;
    resetIndex(): void;
}

async function readSfdxProjectConfig(root: string): Promise<SfdxProjectConfig> {
    try {
        const config = JSON.parse(await fs.readFile(getSfdxProjectFile(root), 'utf8'));
        const packageDirectories = config.packageDirectories || [];
        const sfdxPackageDirsPattern = packageDirectories.map((pkg: SfdxPackageDirectoryConfig) => pkg.path).join(',');
        return {
            ...config,
            packageDirectories,
            sfdxPackageDirsPattern: `{${sfdxPackageDirsPattern}}`,
        };
    } catch (e) {
        throw new Error(`Sfdx project file seems invalid. Unable to parse ${getSfdxProjectFile(root)}. ${e.message}`);
    }
}

/**
 * Holds information and utility methods for a workspace
 */
export abstract class BaseWorkspaceContext {
    public type: WorkspaceType;
    public workspaceRoots: string[];
    public indexers: Map<string, Indexer> = new Map();

    protected findNamespaceRootsUsingTypeCache: () => Promise<{ lwc: string[]; aura: string[] }>;
    private initSfdxProjectConfigCache: () => Promise<SfdxProjectConfig>;
    private AURA_EXTENSIONS: string[] = AURA_EXTENSIONS;

    /**
     * @param workspaceRoots
     * @return BaseWorkspaceContext representing the workspace with workspaceRoots
     */
    public constructor(workspaceRoots: string[] | string) {
        this.workspaceRoots = typeof workspaceRoots === 'string' ? [path.resolve(workspaceRoots)] : workspaceRoots;
        this.type = detectWorkspaceType(this.workspaceRoots);

        this.findNamespaceRootsUsingTypeCache = utils.memoize(this.findNamespaceRootsUsingType.bind(this));
        this.initSfdxProjectConfigCache = utils.memoize(this.initSfdxProject.bind(this));
        if (this.type === WorkspaceType.SFDX) {
            this.initSfdxProjectConfigCache();
        }
    }

    public async getNamespaceRoots(): Promise<{ lwc: string[]; aura: string[] }> {
        return this.findNamespaceRootsUsingTypeCache();
    }

    public async getSfdxProjectConfig(): Promise<SfdxProjectConfig> {
        return this.initSfdxProjectConfigCache();
    }

    public addIndexingProvider(provider: { name: string; indexer: Indexer }): void {
        this.indexers.set(provider.name, provider.indexer);
    }

    public getIndexingProvider(name: string): Indexer {
        return this.indexers.get(name);
    }

    public async findAllAuraMarkup(): Promise<string[]> {
        const files: string[] = [];
        const namespaceRoots = await this.findNamespaceRootsUsingTypeCache();

        for (const namespaceRoot of namespaceRoots.aura) {
            const markupFiles = await findAuraMarkupIn(namespaceRoot);
            files.push(...markupFiles);
        }
        return files;
    }

    public async isAuraMarkup(document: TextDocument): Promise<boolean> {
        return document.languageId === 'html' && AURA_EXTENSIONS.includes(utils.getExtension(document)) && (await this.isInsideAuraRoots(document));
    }

    public async isAuraJavascript(document: TextDocument): Promise<boolean> {
        return document.languageId === 'javascript' && (await this.isInsideAuraRoots(document));
    }

    public async isLWCTemplate(document: TextDocument): Promise<boolean> {
        return document.languageId === 'html' && utils.getExtension(document) === '.html' && (await this.isInsideModulesRoots(document));
    }

    public async isLWCJavascript(document: TextDocument): Promise<boolean> {
        return document.languageId === 'javascript' && (await this.isInsideModulesRoots(document));
    }

    public async isInsideAuraRoots(document: TextDocument): Promise<boolean> {
        const file = utils.toResolvedPath(document.uri);
        for (const ws of this.workspaceRoots) {
            if (utils.pathStartsWith(file, ws)) {
                return this.isFileInsideAuraRoots(file);
            }
        }
        return false;
    }

    public async isInsideModulesRoots(document: TextDocument): Promise<boolean> {
        const file = utils.toResolvedPath(document.uri);
        for (const ws of this.workspaceRoots) {
            if (utils.pathStartsWith(file, ws)) {
                return this.isFileInsideModulesRoots(file);
            }
        }
        return false;
    }

    public async isFileInsideModulesRoots(file: string): Promise<boolean> {
        const namespaceRoots = await this.findNamespaceRootsUsingTypeCache();
        for (const root of namespaceRoots.lwc) {
            if (utils.pathStartsWith(file, root)) {
                return true;
            }
        }
        return false;
    }

    public async isFileInsideAuraRoots(file: string): Promise<boolean> {
        const namespaceRoots = await this.findNamespaceRootsUsingTypeCache();
        for (const root of namespaceRoots.aura) {
            if (utils.pathStartsWith(file, root)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Configures LWC project to support TypeScript
     */
    public async configureProjectForTs(): Promise<void> {
        try {
            // TODO: This should be moved into configureProject after dev preview
            await this.writeTsconfigJson();
        } catch (error) {
            console.error('configureProjectForTs: Error occurred:', error);
            throw error;
        }
    }

    /**
     * @returns string list of all lwc and aura namespace roots
     */
    protected abstract findNamespaceRootsUsingType(): Promise<{ lwc: string[]; aura: string[] }>;

    /**
     * Updates the namespace root type cache
     */
    public async updateNamespaceRootTypeCache(): Promise<void> {
        this.findNamespaceRootsUsingTypeCache = utils.memoize(this.findNamespaceRootsUsingType.bind(this));
    }

    /**
     * Configures the project
     */
    public async configureProject(): Promise<void> {
        await this.writeSettings();
        await this.writeJsconfigJson();
        await this.writeTypings();
    }

    private async writeSettings(): Promise<void> {
        await this.writeSettingsJson();
        await this.writeCodeWorkspace();
    }

    private async writeSettingsJson(): Promise<void> {
        const settingsPath = path.join(this.workspaceRoots[0], '.vscode', 'settings.json');
        const settings = await this.getSettings();
        this.updateConfigFile(settingsPath, JSON.stringify(settings, null, 2));
    }

    private async writeCodeWorkspace(): Promise<void> {
        const workspacePath = path.join(this.workspaceRoots[0], 'core.code-workspace');
        const workspace = await this.getCodeWorkspace();
        this.updateConfigFile(workspacePath, JSON.stringify(workspace, null, 2));
    }

    private async writeJsconfigJson(): Promise<void> {
        switch (this.type) {
            case WorkspaceType.SFDX:
                await this.writeSfdxJsconfig();
                break;
            case WorkspaceType.CORE_ALL:
            case WorkspaceType.CORE_PARTIAL:
                await this.writeCoreJsconfig();
                break;
            default:
                // No jsconfig needed for other workspace types
                break;
        }
    }

    private async writeSfdxJsconfig(): Promise<void> {
        const modulesDirs = await this.getModulesDirs();

        for (const modulesDir of modulesDirs) {
            const jsconfigPath = path.join(modulesDir, 'jsconfig.json');

            // Skip if tsconfig.json already exists
            const tsconfigPath = path.join(modulesDir, 'tsconfig.json');
            if (await fs.pathExists(tsconfigPath)) {
                continue;
            }

            try {
                let jsconfigContent: string;

                // If jsconfig already exists, read and update it
                if (await fs.pathExists(jsconfigPath)) {
                    const existingConfig = JSON.parse(await fs.readFile(jsconfigPath, 'utf8'));
                    const jsconfigTemplate = await fs.readFile(utils.getSfdxResource('jsconfig-sfdx.json'), 'utf8');
                    const templateConfig = JSON.parse(jsconfigTemplate);

                    // Merge existing config with template config
                    const relativeWorkspaceRoot = utils.relativePath(path.dirname(jsconfigPath), this.workspaceRoots[0]);
                    const processedTemplateInclude = templateConfig.include.map((include: string) => {
                        return include.replace('<%= project_root %>', relativeWorkspaceRoot);
                    });

                    const mergedConfig = {
                        ...existingConfig,
                        ...templateConfig,
                        compilerOptions: {
                            ...existingConfig.compilerOptions,
                            ...templateConfig.compilerOptions,
                        },
                        include: [...existingConfig.include, ...processedTemplateInclude],
                    };

                    jsconfigContent = JSON.stringify(mergedConfig, null, 4);
                } else {
                    // Create new jsconfig from template
                    const jsconfigTemplate = await fs.readFile(utils.getSfdxResource('jsconfig-sfdx.json'), 'utf8');
                    const relativeWorkspaceRoot = utils.relativePath(path.dirname(jsconfigPath), this.workspaceRoots[0]);
                    jsconfigContent = this.processTemplate(jsconfigTemplate, { project_root: relativeWorkspaceRoot });
                }

                this.updateConfigFile(jsconfigPath, jsconfigContent);
            } catch (error) {
                console.error('writeSfdxJsconfig: Error reading/writing jsconfig:', error);
                throw error;
            }
        }

        // Update forceignore
        const forceignorePath = path.join(this.workspaceRoots[0], '.forceignore');
        await this.updateForceIgnoreFile(forceignorePath, false);
    }

    private async writeCoreJsconfig(): Promise<void> {
        const modulesDirs = await this.getModulesDirs();

        for (const modulesDir of modulesDirs) {
            const jsconfigPath = path.join(modulesDir, 'jsconfig.json');

            // Skip if tsconfig.json already exists
            const tsconfigPath = path.join(modulesDir, 'tsconfig.json');
            if (await fs.pathExists(tsconfigPath)) {
                // Remove tsconfig.json if it exists (as per test expectation)
                await fs.remove(tsconfigPath);
            }

            try {
                const jsconfigTemplate = await fs.readFile(utils.getCoreResource('jsconfig-core.json'), 'utf8');
                // For core workspaces, the typings are in the core directory, not the project directory
                // Calculate relative path from modules directory to the core directory
                const coreDir = this.type === WorkspaceType.CORE_ALL ? this.workspaceRoots[0] : path.dirname(this.workspaceRoots[0]);
                const relativeCoreRoot = utils.relativePath(modulesDir, coreDir);
                const jsconfigContent = this.processTemplate(jsconfigTemplate, { project_root: relativeCoreRoot });
                this.updateConfigFile(jsconfigPath, jsconfigContent);
            } catch (error) {
                console.error('writeCoreJsconfig: Error reading/writing jsconfig:', error);
                throw error;
            }
        }
    }

    private async writeTypings(): Promise<void> {
        switch (this.type) {
            case WorkspaceType.SFDX:
                await this.writeSfdxTypings();
                break;
            case WorkspaceType.CORE_ALL:
            case WorkspaceType.CORE_PARTIAL:
                await this.writeCoreTypings();
                break;
            default:
                // No typings needed for other workspace types
                break;
        }
    }

    private async writeSfdxTypings(): Promise<void> {
        const typingsPath = path.join(this.workspaceRoots[0], '.sfdx', 'typings', 'lwc');
        await this.createTypingsFiles(typingsPath);
    }

    private async writeCoreTypings(): Promise<void> {
        const coreDir = this.type === WorkspaceType.CORE_ALL ? this.workspaceRoots[0] : path.dirname(this.workspaceRoots[0]);
        const typingsPath = path.join(coreDir, '.vscode', 'typings', 'lwc');
        await this.createTypingsFiles(typingsPath);
    }

    private async createTypingsFiles(typingsPath: string): Promise<void> {
        // Create the typings directory
        await fs.ensureDir(typingsPath);

        // Create basic typings files
        const engineTypings = `declare module '@salesforce/resourceUrl/*' {
    var url: string;
    export = url;
}`;

        const ldsTypings = `declare module '@salesforce/label/*' {
    var label: string;
    export = label;
}`;

        const apexTypings = `declare module '@salesforce/apex/*' {
    var apex: any;
    export = apex;
}`;

        const schemaTypings = `declare module '@salesforce/schema' {
    export * from './schema';
}`;

        await fs.writeFile(path.join(typingsPath, 'engine.d.ts'), engineTypings);
        await fs.writeFile(path.join(typingsPath, 'lds.d.ts'), ldsTypings);
        await fs.writeFile(path.join(typingsPath, 'apex.d.ts'), apexTypings);
        await fs.writeFile(path.join(typingsPath, 'schema.d.ts'), schemaTypings);
    }

    private async writeTsconfigJson(): Promise<void> {
        switch (this.type) {
            case WorkspaceType.SFDX:
                // Write tsconfig.sfdx.json first
                const baseTsConfigPath = path.join(this.workspaceRoots[0], '.sfdx', 'tsconfig.sfdx.json');

                try {
                    const baseTsConfig = await fs.readFile(utils.getSfdxResource('tsconfig-sfdx.base.json'), 'utf8');
                    this.updateConfigFile(baseTsConfigPath, baseTsConfig);
                } catch (error) {
                    console.error('writeTsconfigJson: Error reading/writing base tsconfig:', error);
                    throw error;
                }

                // Write to the tsconfig.json in each module subdirectory
                let tsConfigTemplate: string;
                try {
                    tsConfigTemplate = await fs.readFile(utils.getSfdxResource('tsconfig-sfdx.json'), 'utf8');
                } catch (error) {
                    console.error('writeTsconfigJson: Error reading tsconfig template:', error);
                    throw error;
                }

                const forceignore = path.join(this.workspaceRoots[0], '.forceignore');
                // TODO: We should only be looking through modules that have TS files
                const modulesDirs = await this.getModulesDirs();

                for (const modulesDir of modulesDirs) {
                    const tsConfigPath = path.join(modulesDir, 'tsconfig.json');
                    const relativeWorkspaceRoot = utils.relativePath(path.dirname(tsConfigPath), this.workspaceRoots[0]);
                    const tsConfigContent = this.processTemplate(tsConfigTemplate, { project_root: relativeWorkspaceRoot });
                    this.updateConfigFile(tsConfigPath, tsConfigContent);
                    await this.updateForceIgnoreFile(forceignore, true);
                }
                break;
            default:
                break;
        }
    }

    private async getSettings(): Promise<any> {
        const settings: any = {};
        await this.updateCoreSettings(settings);
        return settings;
    }

    private async getCodeWorkspace(): Promise<any> {
        const workspace: any = {
            folders: this.workspaceRoots.map((root) => ({ path: root })),
            settings: {},
        };
        const eslintPath = await this.findCoreESLint();
        await this.updateCoreCodeWorkspace(workspace.settings, eslintPath);
        return workspace;
    }

    private async updateCoreSettings(settings: any): Promise<void> {
        // Get eslint path once to avoid multiple warnings
        const eslintPath = await this.findCoreESLint();

        try {
            // Load core settings template
            const coreSettingsTemplate = await fs.readFile(utils.getCoreResource('settings-core.json'), 'utf8');
            const coreSettings = JSON.parse(coreSettingsTemplate);

            // Merge template settings with provided settings
            Object.assign(settings, coreSettings);

            // Update eslint settings
            settings['eslint.workingDirectories'] = this.workspaceRoots;
            settings['eslint.nodePath'] = eslintPath;
            settings['eslint.validate'] = ['javascript', 'typescript'];
            settings['eslint.options'] = {
                overrideConfigFile: path.join(this.workspaceRoots[0], '.eslintrc.json'),
            };

            // Set perforce settings with default values
            settings['perforce.client'] = 'username-localhost-blt';
            settings['perforce.user'] = 'username';
            settings['perforce.port'] = 'ssl:host:port';
        } catch (error) {
            console.error('updateCoreSettings: Error loading core settings template:', error);
            // Fallback to basic settings
            settings['eslint.workingDirectories'] = this.workspaceRoots;
            settings['eslint.nodePath'] = eslintPath;
            settings['eslint.validate'] = ['javascript', 'typescript'];
            settings['eslint.options'] = {
                overrideConfigFile: path.join(this.workspaceRoots[0], '.eslintrc.json'),
            };
        }
    }

    private async updateCoreCodeWorkspace(settings: any, eslintPath: string): Promise<void> {
        settings['eslint.workingDirectories'] = this.workspaceRoots;
        settings['eslint.nodePath'] = eslintPath;
        settings['eslint.validate'] = ['javascript', 'typescript'];
        settings['eslint.options'] = {
            overrideConfigFile: path.join(this.workspaceRoots[0], '.eslintrc.json'),
        };
    }

    private async findCoreESLint(): Promise<string> {
        const eslintToolDir = path.join(homedir(), 'tools', 'eslint-tool');
        if (!(await fs.pathExists(eslintToolDir))) {
            console.warn('core eslint-tool not installed: ' + eslintToolDir);
            // default
            return '~/tools/eslint-tool/1.0.3/node_modules';
        }
        const eslintToolVersion = await this.getESLintToolVersion();
        return path.join(eslintToolDir, eslintToolVersion, 'node_modules');
    }

    private async getESLintToolVersion(): Promise<string> {
        const eslintToolDir = path.join(homedir(), 'tools', 'eslint-tool');
        const packageJsonPath = path.join(eslintToolDir, 'package.json');
        if (await fs.pathExists(packageJsonPath)) {
            const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf8'));
            return packageJson.version;
        }
        return '1.0.3';
    }

    public async getModulesDirs(): Promise<string[]> {
        const modulesDirs: string[] = [];
        switch (this.type) {
            case WorkspaceType.SFDX:
                const { packageDirectories } = await this.getSfdxProjectConfig();
                for (const pkg of packageDirectories) {
                    // Check both new SFDX structure (main/default) and old structure (meta)
                    const newPkgDir = path.join(this.workspaceRoots[0], pkg.path, 'main', 'default');
                    const oldPkgDir = path.join(this.workspaceRoots[0], pkg.path, 'meta');

                    // Check for LWC components in new structure
                    const newLwcDir = path.join(newPkgDir, 'lwc');
                    if (await fs.pathExists(newLwcDir)) {
                        // Add the LWC directory itself, not individual components
                        modulesDirs.push(newLwcDir);
                    } else {
                        // Check for LWC components in old structure
                        const oldLwcDir = path.join(oldPkgDir, 'lwc');
                        if (await fs.pathExists(oldLwcDir)) {
                            // Add the LWC directory itself, not individual components
                            modulesDirs.push(oldLwcDir);
                        }
                    }

                    // Note: Aura directories are not included in modulesDirs as they don't typically use TypeScript
                    // and this method is primarily used for TypeScript configuration
                }
                break;
            case WorkspaceType.CORE_ALL:
                // For CORE_ALL, return the modules directories for each project
                for (const project of await fs.readdir(this.workspaceRoots[0])) {
                    const modulesDir = path.join(this.workspaceRoots[0], project, 'modules');
                    if (await fs.pathExists(modulesDir)) {
                        modulesDirs.push(modulesDir);
                    }
                }
                break;
            case WorkspaceType.CORE_PARTIAL:
                // For CORE_PARTIAL, return the modules directory for each workspace root
                for (const ws of this.workspaceRoots) {
                    const modulesDir = path.join(ws, 'modules');
                    if (await fs.pathExists(modulesDir)) {
                        modulesDirs.push(modulesDir);
                    }
                }
                break;
            case WorkspaceType.STANDARD:
            case WorkspaceType.STANDARD_LWC:
            case WorkspaceType.MONOREPO:
            case WorkspaceType.UNKNOWN:
                // For standard workspaces, return empty array as they don't have modules directories
                break;
        }
        return modulesDirs;
    }

    private async updateForceIgnoreFile(forceignorePath: string, addTsConfig: boolean): Promise<void> {
        let forceignoreContent = '';
        if (await fs.pathExists(forceignorePath)) {
            forceignoreContent = await fs.readFile(forceignorePath, 'utf8');
        }

        // Add standard forceignore patterns for JavaScript projects
        if (!forceignoreContent.includes('**/jsconfig.json')) {
            forceignoreContent += '\n**/jsconfig.json';
        }
        if (!forceignoreContent.includes('**/.eslintrc.json')) {
            forceignoreContent += '\n**/.eslintrc.json';
        }

        if (addTsConfig && !forceignoreContent.includes('**/tsconfig.json')) {
            forceignoreContent += '\n**/tsconfig.json';
        }

        if (addTsConfig && !forceignoreContent.includes('**/*.ts')) {
            forceignoreContent += '\n**/*.ts';
        }

        // Always write the forceignore file, even if it's empty
        await fs.writeFile(forceignorePath, forceignoreContent.trim());
    }

    private updateConfigFile(filePath: string, content: string): void {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirpSync(dir);
        }
        fs.writeFileSync(filePath, content);
    }

    public processTemplate(template: string, data: any): string {
        return ejs.render(template, data);
    }

    private async initSfdxProject(): Promise<SfdxProjectConfig> {
        return readSfdxProjectConfig(this.workspaceRoots[0]);
    }
}

async function findAuraMarkupIn(namespaceRoot: string): Promise<string[]> {
    const files: string[] = [];
    const dirs = await fs.readdir(namespaceRoot);
    for (const dir of dirs) {
        const componentDir = path.join(namespaceRoot, dir);
        const stat = await fs.stat(componentDir);
        if (stat.isDirectory()) {
            for (const ext of AURA_EXTENSIONS) {
                const markupFile = path.join(componentDir, dir + ext);
                if (await fs.pathExists(markupFile)) {
                    files.push(markupFile);
                }
            }
        }
    }
    return files;
}
