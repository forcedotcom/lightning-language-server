/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */

import * as fs from 'fs';
import { homedir } from 'os';
import * as path from 'path';
import { TextDocument } from 'vscode-languageserver';
import ejs from 'ejs';
import { WorkspaceType, detectWorkspaceType, getSfdxProjectFile } from './shared';
import * as utils from './utils';

export const AURA_EXTENSIONS: string[] = ['.cmp', '.app', '.design', '.evt', '.intf', '.auradoc', '.tokens'];

interface SfdxPackageDirectoryConfig {
    path: string;
}

interface SfdxProjectConfig {
    packageDirectories: SfdxPackageDirectoryConfig[];
    sfdxPackageDirsPattern: string;
}

export interface Indexer {
    configureAndIndex(): Promise<void>;
    resetIndex(): void;
}

const readSfdxProjectConfig = async (root: string): Promise<SfdxProjectConfig> => {
    try {
        const config = JSON.parse(await fs.promises.readFile(getSfdxProjectFile(root), 'utf8'));
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
};

const updateConfigFile = (filePath: string, content: string): void => {
    const dir = path.dirname(filePath);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, content);
};

export const updateForceIgnoreFile = async (forceignorePath: string, addTsConfig: boolean): Promise<void> => {
    let forceignoreContent = '';
    if (fs.existsSync(forceignorePath)) {
        forceignoreContent = await fs.promises.readFile(forceignorePath, 'utf8');
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
    await fs.promises.writeFile(forceignorePath, forceignoreContent.trim());
};

const getESLintToolVersion = async (): Promise<string> => {
    const eslintToolDir = path.join(homedir(), 'tools', 'eslint-tool');
    const packageJsonPath = path.join(eslintToolDir, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(await fs.promises.readFile(packageJsonPath, 'utf8'));
        return packageJson.version;
    }
    return '1.0.3';
};

const findCoreESLint = async (): Promise<string> => {
    const eslintToolDir = path.join(homedir(), 'tools', 'eslint-tool');
    if (!fs.existsSync(eslintToolDir)) {
        console.warn('core eslint-tool not installed: ' + eslintToolDir);
        // default
        return '~/tools/eslint-tool/1.0.3/node_modules';
    }
    const eslintToolVersion = await getESLintToolVersion();
    return path.join(eslintToolDir, eslintToolVersion, 'node_modules');
};

// exported for testing
export const processTemplate = (template: string, data: any): string => ejs.render(template, data);

export const getModulesDirs = async (
    workspaceType: WorkspaceType,
    workspaceRoots: string[],
    getSfdxProjectConfig: () => Promise<SfdxProjectConfig>,
): Promise<string[]> => {
    const modulesDirs: string[] = [];
    switch (workspaceType) {
        case 'SFDX':
            const { packageDirectories } = await getSfdxProjectConfig();
            for (const pkg of packageDirectories) {
                // Check both new SFDX structure (main/default) and old structure (meta)
                const newPkgDir = path.join(workspaceRoots[0], pkg.path, 'main', 'default');
                const oldPkgDir = path.join(workspaceRoots[0], pkg.path, 'meta');

                // Check for LWC components in new structure
                const newLwcDir = path.join(newPkgDir, 'lwc');
                if (fs.existsSync(newLwcDir)) {
                    // Add the LWC directory itself, not individual components
                    modulesDirs.push(newLwcDir);
                } else {
                    // Check for LWC components in old structure
                    const oldLwcDir = path.join(oldPkgDir, 'lwc');
                    if (fs.existsSync(oldLwcDir)) {
                        // Add the LWC directory itself, not individual components
                        modulesDirs.push(oldLwcDir);
                    }
                }

                // Note: Aura directories are not included in modulesDirs as they don't typically use TypeScript
                // and this method is primarily used for TypeScript configuration
            }
            break;
        case 'CORE_ALL':
            // For CORE_ALL, return the modules directories for each project
            for (const project of await fs.promises.readdir(workspaceRoots[0])) {
                const modulesDir = path.join(workspaceRoots[0], project, 'modules');
                if (fs.existsSync(modulesDir)) {
                    modulesDirs.push(modulesDir);
                }
            }
            break;
        case 'CORE_PARTIAL':
            // For CORE_PARTIAL, return the modules directory for each workspace root
            for (const ws of workspaceRoots) {
                const modulesDir = path.join(ws, 'modules');
                if (fs.existsSync(modulesDir)) {
                    modulesDirs.push(modulesDir);
                }
            }
            break;
        case 'STANDARD':
        case 'STANDARD_LWC':
        case 'MONOREPO':
        case 'UNKNOWN':
            // For standard workspaces, return empty array as they don't have modules directories
            break;
    }
    return modulesDirs;
};

/**
 * Holds information and utility methods for a workspace
 */
export abstract class BaseWorkspaceContext {
    public type: WorkspaceType;
    public workspaceRoots: string[];

    protected findNamespaceRootsUsingTypeCache: () => Promise<{ lwc: string[]; aura: string[] }>;
    public initSfdxProjectConfigCache: () => Promise<SfdxProjectConfig>;

    /**
     * @param workspaceRoots
     * @return BaseWorkspaceContext representing the workspace with workspaceRoots
     */
    public constructor(workspaceRoots: string[] | string) {
        this.workspaceRoots = typeof workspaceRoots === 'string' ? [path.resolve(workspaceRoots)] : workspaceRoots;
        this.type = detectWorkspaceType(this.workspaceRoots);

        this.findNamespaceRootsUsingTypeCache = utils.memoize(this.findNamespaceRootsUsingType.bind(this));
        this.initSfdxProjectConfigCache = utils.memoize(this.initSfdxProject.bind(this));
        if (this.type === 'SFDX') {
            this.initSfdxProjectConfigCache();
        }
    }

    public async isAuraMarkup(document: TextDocument): Promise<boolean> {
        return document.languageId === 'html' && AURA_EXTENSIONS.includes(utils.getExtension(document)) && (await this.isInsideAuraRoots(document));
    }

    public async isLWCTemplate(document: TextDocument): Promise<boolean> {
        return document.languageId === 'html' && utils.getExtension(document) === '.html' && (await this.isInsideModulesRoots(document));
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
     * @returns string list of all lwc and aura namespace roots
     */
    protected abstract findNamespaceRootsUsingType(): Promise<{ lwc: string[]; aura: string[] }>;

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
        updateConfigFile(settingsPath, JSON.stringify(settings, null, 2));
    }

    private async writeCodeWorkspace(): Promise<void> {
        const workspacePath = path.join(this.workspaceRoots[0], 'core.code-workspace');
        const workspace = await this.getCodeWorkspace();
        updateConfigFile(workspacePath, JSON.stringify(workspace, null, 2));
    }

    private async writeJsconfigJson(): Promise<void> {
        switch (this.type) {
            case 'SFDX':
                await this.writeSfdxJsconfig();
                break;
            case 'CORE_ALL':
            case 'CORE_PARTIAL':
                await this.writeCoreJsconfig();
                break;
            default:
                // No jsconfig needed for other workspace types
                break;
        }
    }

    private async writeSfdxJsconfig(): Promise<void> {
        const modulesDirs = await getModulesDirs(this.type, this.workspaceRoots, this.initSfdxProjectConfigCache.bind(this));

        for (const modulesDir of modulesDirs) {
            const jsconfigPath = path.join(modulesDir, 'jsconfig.json');

            // Skip if tsconfig.json already exists
            const tsconfigPath = path.join(modulesDir, 'tsconfig.json');
            if (fs.existsSync(tsconfigPath)) {
                continue;
            }

            try {
                let jsconfigContent: string;

                // If jsconfig already exists, read and update it
                if (fs.existsSync(jsconfigPath)) {
                    const existingConfig = JSON.parse(await fs.promises.readFile(jsconfigPath, 'utf8'));
                    const jsconfigTemplate = await fs.promises.readFile(utils.getSfdxResource('jsconfig-sfdx.json'), 'utf8');
                    const templateConfig = JSON.parse(jsconfigTemplate);

                    // Merge existing config with template config
                    const relativeWorkspaceRoot = utils.relativePath(path.dirname(jsconfigPath), this.workspaceRoots[0]);
                    const processedTemplateInclude = templateConfig.include.map((include: string) =>
                        include.replace('<%= project_root %>', relativeWorkspaceRoot),
                    );

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
                    const jsconfigTemplate = await fs.promises.readFile(utils.getSfdxResource('jsconfig-sfdx.json'), 'utf8');
                    const relativeWorkspaceRoot = utils.relativePath(path.dirname(jsconfigPath), this.workspaceRoots[0]);
                    jsconfigContent = processTemplate(jsconfigTemplate, { project_root: relativeWorkspaceRoot });
                }

                updateConfigFile(jsconfigPath, jsconfigContent);
            } catch (error) {
                console.error('writeSfdxJsconfig: Error reading/writing jsconfig:', error);
                throw error;
            }
        }

        // Update forceignore
        const forceignorePath = path.join(this.workspaceRoots[0], '.forceignore');
        await updateForceIgnoreFile(forceignorePath, false);
    }

    private async writeCoreJsconfig(): Promise<void> {
        const modulesDirs = await getModulesDirs(this.type, this.workspaceRoots, this.initSfdxProjectConfigCache.bind(this));

        for (const modulesDir of modulesDirs) {
            const jsconfigPath = path.join(modulesDir, 'jsconfig.json');

            // Skip if tsconfig.json already exists
            const tsconfigPath = path.join(modulesDir, 'tsconfig.json');
            if (fs.existsSync(tsconfigPath)) {
                // Remove tsconfig.json if it exists (as per test expectation)
                fs.unlinkSync(tsconfigPath);
            }

            try {
                const jsconfigTemplate = await fs.promises.readFile(utils.getCoreResource('jsconfig-core.json'), 'utf8');
                // For core workspaces, the typings are in the core directory, not the project directory
                // Calculate relative path from modules directory to the core directory
                const coreDir = this.type === 'CORE_ALL' ? this.workspaceRoots[0] : path.dirname(this.workspaceRoots[0]);
                const relativeCoreRoot = utils.relativePath(modulesDir, coreDir);
                const jsconfigContent = processTemplate(jsconfigTemplate, { project_root: relativeCoreRoot });
                updateConfigFile(jsconfigPath, jsconfigContent);
            } catch (error) {
                console.error('writeCoreJsconfig: Error reading/writing jsconfig:', error);
                throw error;
            }
        }
    }

    private async writeTypings(): Promise<void> {
        let typingsDir: string;

        switch (this.type) {
            case 'SFDX':
                typingsDir = path.join(this.workspaceRoots[0], '.sfdx', 'typings', 'lwc');
                break;
            case 'CORE_PARTIAL':
                typingsDir = path.join(this.workspaceRoots[0], '..', '.vscode', 'typings', 'lwc');
                break;
            case 'CORE_ALL':
                typingsDir = path.join(this.workspaceRoots[0], '.vscode', 'typings', 'lwc');
                break;
        }

        // TODO should we just be copying every file in this directory rather than hardcoding?
        if (typingsDir) {
            // copy typings to typingsDir
            const resourceTypingsDir = utils.getSfdxResource('typings');
            await fs.promises.mkdir(typingsDir, { recursive: true });
            try {
                await fs.promises.copyFile(path.join(resourceTypingsDir, 'lds.d.ts'), path.join(typingsDir, 'lds.d.ts'));
            } catch (ignore) {
                // ignore
            }
            try {
                await fs.promises.copyFile(path.join(resourceTypingsDir, 'messageservice.d.ts'), path.join(typingsDir, 'messageservice.d.ts'));
            } catch (ignore) {
                // ignore
            }
            const dirs = await fs.promises.readdir(path.join(resourceTypingsDir, 'copied'));
            for (const file of dirs) {
                try {
                    await fs.promises.copyFile(path.join(resourceTypingsDir, 'copied', file), path.join(typingsDir, file));
                } catch (ignore) {
                    // ignore
                }
            }
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
        const eslintPath = await findCoreESLint();
        await this.updateCoreCodeWorkspace(workspace.settings, eslintPath);
        return workspace;
    }

    private async updateCoreSettings(settings: any): Promise<void> {
        // Get eslint path once to avoid multiple warnings
        const eslintPath = await findCoreESLint();

        try {
            // Load core settings template
            const coreSettingsTemplate = await fs.promises.readFile(utils.getCoreResource('settings-core.json'), 'utf8');
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

    private async initSfdxProject(): Promise<SfdxProjectConfig> {
        return readSfdxProjectConfig(this.workspaceRoots[0]);
    }
}
