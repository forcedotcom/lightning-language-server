import * as fs from 'fs-extra';

import { homedir } from 'os';
import * as path from 'path';
import { join } from 'path';
import { lt } from 'semver';
import { TextDocument, Files } from 'vscode-languageserver';
// @ts-ignore
import templateSettings from 'lodash.templatesettings';
// @ts-ignore
import template from 'lodash.template';
// @ts-ignore
import { parse } from 'properties';

import { WorkspaceType, detectWorkspaceType, getSfdxProjectFile, isLWC } from './shared';
import * as utils from './utils';
import { componentUtil } from './index';

export interface ISfdxPackageDirectoryConfig {
    path: string;
}

export interface ISfdxProjectConfig {
    packageDirectories: ISfdxPackageDirectoryConfig[];
    sfdxPackageDirsPattern: string;
}

export interface Indexer {
    configureAndIndex(): Promise<void>;
    resetIndex(): void;
}
/**
 * Holds information and utility methods for a LWC workspace
 */
export class WorkspaceContext {
    public type: WorkspaceType;
    public workspaceRoots: string[];
    public indexers: Map<string, Indexer> = new Map();

    private findNamespaceRootsUsingTypeCache: () => Promise<{ lwc: string[]; aura: string[] }>;
    // private initSfdxProjectConfigCache: () => Promise<ISfdxProjectConfig>;
    private initSfdxProjectConfigCache: () => Promise<ISfdxProjectConfig[]>;
    private AURA_EXTENSIONS: string[] = ['.cmp', '.app', '.design', '.evt', '.intf', '.auradoc', '.tokens'];

    /**
     * @param  {string[]|string} workspaceRoots
     * @return WorkspaceContext representing the workspace with workspaceRoots
     */
    public constructor(workspaceRoots: string[] | string) {
        if (typeof workspaceRoots === 'string') {
            this.workspaceRoots = [path.resolve(workspaceRoots)];
        } else {
            const resolved: string[] = [];
            for (const ws of workspaceRoots) {
                resolved.push(path.resolve(ws));
            }
            this.workspaceRoots = resolved;
        }
        // this.workspaceRoots = typeof workspaceRoots === 'string' ? [path.resolve(workspaceRoots)] : workspaceRoots;
      
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

    public async getSfdxProjectConfig(): Promise<ISfdxProjectConfig[]> {
        return this.initSfdxProjectConfigCache();
    }

    public addIndexingProvider(provider: { name: string; indexer: Indexer }): void {
        this.indexers.set(provider.name, provider.indexer);
    }

    public getIndexingProvider(name: string): Indexer {
        return this.indexers.get(name);
    }

    /**
     * @return all the .js module files in the workspace
     */
    public async findAllModules(): Promise<string[]> {
        const files: string[] = [];
        const namespaceRoots = await this.findNamespaceRootsUsingTypeCache();
        for (const namespaceRoot of namespaceRoots.lwc) {
            files.push(...(await findModulesIn(namespaceRoot)));
        }
        return files;
    }

    public async findAllAuraMarkup(): Promise<string[]> {
        const files: string[] = [];
        const namespaceRoots = await this.findNamespaceRootsUsingTypeCache();
        for (const namespaceRoot of namespaceRoots.aura) {
            files.push(...(await findAuraMarkupIn(namespaceRoot)));
        }
        return files;
    }

    public async isAuraMarkup(document: TextDocument): Promise<boolean> {
        return document.languageId === 'html' && this.AURA_EXTENSIONS.includes(utils.getExtension(document)) && (await this.isInsideAuraRoots(document));
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
     * Configures a LWC project
     */
    public async configureProject() {
        this.findNamespaceRootsUsingTypeCache = utils.memoize(this.findNamespaceRootsUsingType.bind(this));
        await this.writeJsconfigJson();
        await this.writeSettings();
        await this.writeTypings();
    }

    /**
     * Acquires list of absolute modules directories, optimizing for workspace type
     * @returns Promise
     */
    public async getModulesDirs(): Promise<string[]> {
        const list: string[] = [];
        switch (this.type) {
            case WorkspaceType.SFDX:
                const sfdxProjectConfigs = await this.getSfdxProjectConfig();
                for (let i = 0; i < this.workspaceRoots.length; i = i + 1) {
                    const ws = this.workspaceRoots[i];
                    const sfdxProjectConfig = sfdxProjectConfigs[i];
                    const wsdirs = await utils.glob(`${sfdxProjectConfig.sfdxPackageDirsPattern}/**/lwc/`, { cwd: ws });
                    for (const wsdir of wsdirs) {
                        list.push(path.join(ws, wsdir));
                    }
                }
            case WorkspaceType.CORE_ALL:
                const dirs = await fs.readdir(this.workspaceRoots[0]);
                for (const project of dirs) {
                    const modulesDir = join(this.workspaceRoots[0], project, 'modules');
                    if (await fs.pathExists(modulesDir)) {
                        list.push(modulesDir);
                    }
                }
                break;
            case WorkspaceType.CORE_PARTIAL:
                for (const ws of this.workspaceRoots) {
                    const modulesDir = join(ws, 'modules');
                    if (await fs.pathExists(modulesDir)) {
                        list.push(modulesDir);
                    }
                }
                break;
        }
        return list;
    }

    public async getModulesDirsFromRoot(ws: string, i: any): Promise<string[]> {
        const list: string[] = [];
        const sfdxProjectConfigs = await this.getSfdxProjectConfig();
        const sfdxProjectConfig = sfdxProjectConfigs[i];
        switch (this.type) {
            case WorkspaceType.SFDX:
                const wsdirs = await utils.glob(`${sfdxProjectConfig.sfdxPackageDirsPattern}/**/lwc/`, { cwd: ws });
                for (const wsdir of wsdirs) {
                    const absWsDir = path.join(ws, wsdir);
                    if (await fs.pathExists(absWsDir)) {
                        list.push(absWsDir);
                    }
                }
        }
        return list;
    }

    private async initSfdxProject() {
        const sfdxProjectConfigs: ISfdxProjectConfig[] = [];
        for (const ws of this.workspaceRoots) {
            const sfdxProjectConfig = await readSfdxProjectConfig(ws);
            // initializing the packageDirs glob pattern prefix
            const packageDirs = getSfdxPackageDirs(sfdxProjectConfig);
            sfdxProjectConfig.sfdxPackageDirsPattern = packageDirs.join();
            if (packageDirs.length > 1) {
                // {} brackets are only needed if there are multiple paths
                sfdxProjectConfig.sfdxPackageDirsPattern = `{${sfdxProjectConfig.sfdxPackageDirsPattern}}`;
            }
            sfdxProjectConfigs.push(sfdxProjectConfig);
        }
        return sfdxProjectConfigs;
    }

    private async writeTypings() {
        let typingsDir: string;

        switch (this.type) {
            case WorkspaceType.SFDX:
                typingsDir = join(this.workspaceRoots[0], '.sfdx', 'typings', 'lwc');
                break;
            case WorkspaceType.CORE_PARTIAL:
                typingsDir = join(this.workspaceRoots[0], '..', '.vscode', 'typings', 'lwc');
                break;
            case WorkspaceType.CORE_ALL:
                typingsDir = join(this.workspaceRoots[0], '.vscode', 'typings', 'lwc');
                break;
        }

        if (typingsDir) {
            // copy typings to typingsDir
            const resourceTypingsDir = utils.getSfdxResource('typings');
            await fs.ensureDir(typingsDir);
            try {
                await fs.copy(join(resourceTypingsDir, 'lds.d.ts'), join(typingsDir, 'lds.d.ts'));
            } catch (ignore) {
                // ignore
            }
            const dirs = await fs.readdir(join(resourceTypingsDir, 'copied'));
            for (const file of dirs) {
                try {
                    await fs.copy(join(resourceTypingsDir, 'copied', file), join(typingsDir, file));
                } catch (ignore) {
                    // ignore
                }
            }
        }
    }

    /**
     * Writes to and updates Jsconfig files and ES Lint files of WorkspaceRoots, optimizing by type
     */
    private async writeJsconfigJson() {
        let jsConfigTemplate: string;
        let jsConfigContent: string;
        const modulesDirs = await this.getModulesDirs();

        switch (this.type) {
            case WorkspaceType.SFDX:
                for (let i = 0; i < this.workspaceRoots.length; i = i + 1) {
                    jsConfigTemplate = await fs.readFile(utils.getSfdxResource('jsconfig-sfdx.json'), 'utf8');
                    const eslintrcTemplate = await fs.readFile(utils.getSfdxResource('eslintrc-sfdx.json'), 'utf8');
                    const ws = this.workspaceRoots[i];
                    const forceignore = join(ws, '.forceignore');
                    const modulesDirsFromRoot = await this.getModulesDirsFromRoot(ws, i);
                    for (const modulesDir of modulesDirsFromRoot) {
                        const jsConfigPath = join(modulesDir, 'jsconfig.json');
                        const relativeWorkspaceRoot = utils.relativePath(path.dirname(jsConfigPath), ws);
                        jsConfigContent = this.processTemplate(jsConfigTemplate, { project_root: relativeWorkspaceRoot });
                        this.updateConfigFile(jsConfigPath, jsConfigContent);
                        const eslintrcPath = join(modulesDir, '.eslintrc.json');
                        this.updateConfigFile(eslintrcPath, eslintrcTemplate);
                        await this.updateForceIgnoreFile(forceignore);
                    }
                }
                break;
            case WorkspaceType.CORE_ALL:
                jsConfigTemplate = await fs.readFile(utils.getCoreResource('jsconfig-core.json'), 'utf8');
                jsConfigContent = this.processTemplate(jsConfigTemplate, { project_root: '../..' });
                for (const modulesDir of modulesDirs) {
                    const jsConfigPath = join(modulesDir, 'jsconfig.json');
                    this.updateConfigFile(jsConfigPath, jsConfigContent);
                }
                break;
            case WorkspaceType.CORE_PARTIAL:
                jsConfigTemplate = await fs.readFile(utils.getCoreResource('jsconfig-core.json'), 'utf8');
                jsConfigContent = this.processTemplate(jsConfigTemplate, { project_root: '../..' });
                for (const modulesDir of modulesDirs) {
                    const jsConfigPath = join(modulesDir, 'jsconfig.json');
                    this.updateConfigFile(jsConfigPath, jsConfigContent); // no workspace reference yet, that comes in update config file
                }
                break;
        }
    }

    private async writeSettings() {
        switch (this.type) {
            case WorkspaceType.SFDX:
                break;
            case WorkspaceType.CORE_ALL:
            // Removing these for now
            // await this.updateCoreCodeWorkspace();
            // await this.updateCoreLaunch();
            case WorkspaceType.CORE_PARTIAL:
                // updateCoreSettings is performed by core's setupVSCode
                await this.updateCoreSettings();
                break;
            default:
                break;
        }
    }

    private async updateCoreSettings() {
        const configBlt = await this.readConfigBlt();
        const variableMap = {
            eslint_node_path: await findCoreESLint(),
            p4_port: configBlt['p4.port'],
            p4_client: configBlt['p4.client'],
            p4_user: configBlt['p4.user'],
        };
        const templateString = await fs.readFile(utils.getCoreResource('settings-core.json'), 'utf8');
        const templateContent = this.processTemplate(templateString, variableMap);
        for (const ws of this.workspaceRoots) {
            await fs.ensureDir(join(ws, '.vscode'));
            this.updateConfigFile(join(ws, '.vscode', 'settings.json'), templateContent);
        }
    }

    private async updateCoreCodeWorkspace() {
        const configBlt = await this.readConfigBlt();
        const variableMap = {
            eslint_node_path: await findCoreESLint(),
            p4_port: configBlt['p4.port'],
            p4_client: configBlt['p4.client'],
            p4_user: configBlt['p4.user'],
        };
        const templateString = await fs.readFile(utils.getCoreResource('core.code-workspace.json'), 'utf8');
        const templateContent = this.processTemplate(templateString, variableMap);
        this.updateConfigFile('core.code-workspace', templateContent);
    }

    private async readConfigBlt() {
        const isMain = this.workspaceRoots[0].indexOf(join('main', 'core')) !== -1;
        let relativeBltDir = isMain ? join('..', '..', '..') : join('..', '..', '..', '..');
        if (this.type === WorkspaceType.CORE_PARTIAL) {
            relativeBltDir = join(relativeBltDir, '..');
        }
        const configBltContent = await fs.readFile(join(this.workspaceRoots[0], relativeBltDir, 'config.blt'), 'utf8');
        return parse(configBltContent);
    }

    private processTemplate(
        templateString: string,
        variableMap: {
            project_root?: string;
            eslint_node_path?: string;
            p4_port?: string;
            p4_client?: string;
            p4_user?: string;
        },
    ) {
        templateSettings.interpolate = /\${([\s\S]+?)}/g;
        const compiled = template(templateString);
        return compiled(variableMap);
    }

    /**
     * Adds to the config file in absolute 'configPath' any missing properties in 'config'
     * (existing properties are not updated)
     */
    private updateConfigFile(configPath: string, config: string) {
        // note: we don't want to use async file i/o here, because we don't want another task
        // to interleve with reading/writing this
        try {
            const configJson = JSON.parse(config);
            if (!fs.pathExistsSync(configPath)) {
                utils.writeJsonSync(configPath, configJson);
            } else {
                try {
                    const fileConfig = utils.readJsonSync(configPath);
                    if (utils.deepMerge(fileConfig, configJson)) {
                        utils.writeJsonSync(configPath, fileConfig);
                    }
                } catch (e) {
                    // misinformed file, write out a fresh one
                    utils.writeJsonSync(configPath, configJson);
                }
            }
        } catch (error) {
            console.warn('Error updating ' + configPath, error);
        }
    }

    private async updateForceIgnoreFile(ignoreFile: string) {
        await utils.appendLineIfMissing(ignoreFile, '**/jsconfig.json');
        await utils.appendLineIfMissing(ignoreFile, '**/.eslintrc.json');
    }

    /**
     * @returns string list of all lwc and aura namespace roots
     */
    private async findNamespaceRootsUsingType(): Promise<{ lwc: string[]; aura: string[] }> {
        const roots: { lwc: string[]; aura: string[] } = {
            lwc: [],
            aura: [],
        };
        switch (this.type) {
            case WorkspaceType.SFDX:
                for (let i = 0; i < this.workspaceRoots.length; i = i + 1) {
                    const sfdxProjectConfigs = await this.getSfdxProjectConfig();
                    const packageDirectories = sfdxProjectConfigs[i].packageDirectories;
                    for (const pkg of packageDirectories) {
                        const pkgDir = join(this.workspaceRoots[i], pkg.path);
                        const subroots = await findNamespaceRoots(pkgDir);
                        roots.lwc.push(...subroots.lwc);
                        roots.aura.push(...subroots.aura);
                    }
                }
                return roots;

            case WorkspaceType.CORE_ALL:
                // optimization: search only inside project/modules/
                for (const project of await fs.readdir(this.workspaceRoots[0])) {
                    const modulesDir = join(this.workspaceRoots[0], project, 'modules');
                    if (await fs.pathExists(modulesDir)) {
                        const subroots = await findNamespaceRoots(modulesDir, 2);
                        roots.lwc.push(...subroots.lwc);
                    }
                    const auraDir = join(this.workspaceRoots[0], project, 'components');
                    if (await fs.pathExists(auraDir)) {
                        const subroots = await findNamespaceRoots(auraDir, 2);
                        roots.aura.push(...subroots.aura);
                    }
                }
                return roots;
            case WorkspaceType.CORE_PARTIAL:
                // optimization: search only inside modules/
                for (const ws of this.workspaceRoots) {
                    const modulesDir = join(ws, 'modules');
                    if (await fs.pathExists(modulesDir)) {
                        const subroots = await findNamespaceRoots(join(ws, 'modules'), 2);
                        roots.lwc.push(...subroots.lwc);
                    }
                    const auraDir = join(ws, 'components');
                    if (await fs.pathExists(auraDir)) {
                        const subroots = await findNamespaceRoots(join(ws, 'components'), 2);
                        roots.aura.push(...subroots.aura);
                    }
                }
                return roots;
            case WorkspaceType.STANDARD:
            case WorkspaceType.STANDARD_LWC:
            case WorkspaceType.MONOREPO:
            case WorkspaceType.UNKNOWN: {
                let depth = 6;
                if (this.type === WorkspaceType.MONOREPO) {
                    depth += 2;
                }
                const unknownroots = await findNamespaceRoots(this.workspaceRoots[0], depth);
                roots.lwc.push(...unknownroots.lwc);
                roots.aura.push(...unknownroots.aura);
                return roots;
            }
        }
        return roots;
    }
}

async function readSfdxProjectConfig(root: string): Promise<ISfdxProjectConfig> {
    try {
        return JSON.parse(await fs.readFile(getSfdxProjectFile(root), 'utf8'));
    } catch (e) {
        throw new Error(`Sfdx project file seems invalid. Unable to parse ${getSfdxProjectFile(root)}. ${e.message}`);
    }
}

function getSfdxPackageDirs(sfdxProjectConfig: ISfdxProjectConfig) {
    return sfdxProjectConfig.packageDirectories.map(packageDir => packageDir.path);
}

/**
 * @param root directory to start searching from
 * @return module namespaces root folders found inside 'root'
 */
async function findNamespaceRoots(root: string, maxDepth: number = 5): Promise<{ lwc: string[]; aura: string[] }> {
    const roots: { lwc: string[]; aura: string[] } = {
        lwc: [],
        aura: [],
    };

    function isModuleRoot(subdirs: string[]): boolean {
        for (const subdir of subdirs) {
            // Is a root if any subdir matches a name/name.js with name.js being a module
            const basename = path.basename(subdir);
            const modulePath = path.join(subdir, basename + '.js');
            if (fs.existsSync(modulePath)) {
                // TODO: check contents for: from 'lwc'?
                return true;
            }
        }
        return false;
    }

    async function isAuraRoot(subdirs: string[]): Promise<boolean> {
        for (const subdir of subdirs) {
            // Is a root if any subdir matches a name/name.js with name.js being a module
            const basename = path.basename(subdir);
            const componentPath = path.join(subdir, basename + '@(.app|.cmp|.intf|.evt|.lib)');
            const files = await utils.glob(componentPath, { cwd: subdir });
            if (files.length > 0) {
                return true;
            }
        }
        return false;
    }

    async function traverse(candidate: string, depth: number): Promise<void> {
        if (--depth < 0) {
            return;
        }

        // skip traversing node_modules and similar
        const filename = path.basename(candidate);
        if (
            filename === 'node_modules' ||
            filename === 'bin' ||
            filename === 'target' ||
            filename === 'jest-modules' ||
            filename === 'repository' ||
            filename === 'git'
        ) {
            return;
        }

        // module_root/name/name.js

        const subdirs = await findSubdirectories(candidate);
        // Is a root if we have a folder called lwc
        const isDirLWC = isModuleRoot(subdirs) || (!path.parse(candidate).ext && path.parse(candidate).name === 'lwc');
        const isAura = await isAuraRoot(subdirs);
        if (isAura) {
            roots.aura.push(path.resolve(candidate));
        }
        if (isDirLWC && !isAura) {
            roots.lwc.push(path.resolve(candidate));
        }
        if (!isDirLWC && !isAura) {
            for (const subdir of subdirs) {
                await traverse(subdir, depth);
            }
        }
    }

    if (fs.existsSync(root)) {
        await traverse(root, maxDepth);
    }
    return roots;
}

/**
 * @return list of .js modules inside namespaceRoot folder
 */
async function findModulesIn(namespaceRoot: string): Promise<string[]> {
    const files: string[] = [];
    const subdirs = await findSubdirectories(namespaceRoot);
    for (const subdir of subdirs) {
        const basename = path.basename(subdir);
        const modulePath = path.join(subdir, basename + '.js');
        if ((await fs.pathExists(modulePath)) && componentUtil.isJSComponent(modulePath)) {
            // TODO: check contents for: from 'lwc'?
            files.push(modulePath);
        }
    }
    return files;
}

/*
 * @return list of .js modules inside namespaceRoot folder
 */
async function findAuraMarkupIn(namespaceRoot: string): Promise<string[]> {
    // const files: string[] = [];
    const files = await utils.glob(join(namespaceRoot, '*', '*@(.app|.cmp|.intf|.evt|.lib)'), { cwd: namespaceRoot });
    return files;
    // const subdirs = await findSubdirectories(namespaceRoot);
    // for (const subdir of subdirs) {
    //     const basename = path.basename(subdir);

    //     const componentPath = join(subdir, basename + '@(.app|.cmp|.intf|.evt|.lib)');
    //     const results = await utils.glob(componentPath, { cwd: subdir });
    //     files.push(...results);
    // }
    // return files;
}

async function findSubdirectories(dir: string): Promise<string[]> {
    const subdirs: string[] = [];
    const dirs = await fs.readdir(dir);
    for (const file of dirs) {
        const subdir = path.join(dir, file);
        if (fs.statSync(subdir).isDirectory()) {
            subdirs.push(subdir);
        }
    }
    return subdirs;
}

async function findCoreESLint(): Promise<string> {
    // use highest version in ~/tools/eslint-tool/{version}
    const eslintToolDir = path.join(homedir(), 'tools', 'eslint-tool');
    if (!(await fs.pathExists(eslintToolDir))) {
        console.warn('core eslint-tool not installed: ' + eslintToolDir);
        // default
        return '~/tools/eslint-tool/1.0.3/node_modules';
    }
    let highestVersion;
    const dirs = await fs.readdir(eslintToolDir);
    for (const file of dirs) {
        const subdir = path.join(eslintToolDir, file);
        if ((await fs.stat(subdir)).isDirectory()) {
            if (!highestVersion || lt(highestVersion, file)) {
                highestVersion = file;
            }
        }
    }
    if (!highestVersion) {
        console.warn('cannot find core eslint in ' + eslintToolDir);
        return null;
    }
    return path.join(eslintToolDir, highestVersion, 'node_modules');
}
