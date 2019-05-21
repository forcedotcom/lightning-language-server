import * as fs from 'fs-extra';

import { homedir } from 'os';
import * as path from 'path';
import { join } from 'path';
import { lt } from 'semver';
import { TextDocument } from 'vscode-languageserver';
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
    // common to all project types
    public readonly type: WorkspaceType;
    public readonly workspaceRoot: string;
    public indexers: Map<string, Indexer> = new Map();

    // for sfdx projectsÍ
    private findNamespaceRootsUsingTypeCache: () => Promise<{ lwc: string[]; aura: string[] }>;
    private initSfdxProjectConfigCache: () => Promise<ISfdxProjectConfig>;
    private AURA_EXTENSIONS: string[] = ['.cmp', '.app', '.design', '.evt', '.intf', '.auradoc', '.tokens'];

    /**
     * @return WorkspaceContext representing the workspace at workspaceRoot
     */
    public constructor(workspaceRoot: string) {
        this.workspaceRoot = path.resolve(workspaceRoot);
        this.type = detectWorkspaceType(workspaceRoot);
        this.findNamespaceRootsUsingTypeCache = utils.memoize(this.findNamespaceRootsUsingType.bind(this));
        this.initSfdxProjectConfigCache = utils.memoize(this.initSfdxProject.bind(this));
        if (this.type === WorkspaceType.SFDX) {
            this.initSfdxProjectConfigCache();
        }
    }

    public async getNamespaceRoots(): Promise<{ lwc: string[]; aura: string[] }> {
        return this.findNamespaceRootsUsingTypeCache();
    }

    public async getSfdxProjectConfig(): Promise<ISfdxProjectConfig> {
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
        if (!utils.pathStartsWith(file, this.workspaceRoot)) {
            return false;
        }
        return this.isFileInsideAuraRoots(file);
    }

    public async isInsideModulesRoots(document: TextDocument): Promise<boolean> {
        const file = utils.toResolvedPath(document.uri);
        if (!utils.pathStartsWith(file, this.workspaceRoot)) {
            return false;
        }
        return this.isFileInsideModulesRoots(file);
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
     * @return list of relative paths to LWC modules directories
     */
    public async getRelativeModulesDirs(): Promise<string[]> {
        const list: string[] = [];
        switch (this.type) {
            case WorkspaceType.SFDX:
                const { sfdxPackageDirsPattern } = await this.getSfdxProjectConfig();
                const wsdirs = await utils.glob(`${sfdxPackageDirsPattern}/**/lwc/`, { cwd: this.workspaceRoot });
                list.push(...wsdirs);
                break;
            case WorkspaceType.CORE_ALL:
                const dirs = await fs.readdir(this.workspaceRoot);
                for (const project of dirs) {
                    const modulesDir = join(project, 'modules');
                    if (await fs.pathExists(join(this.workspaceRoot, modulesDir))) {
                        list.push(modulesDir);
                    }
                }
                break;
            case WorkspaceType.CORE_SINGLE_PROJECT:
                list.push('modules');
                break;
        }
        return list;
    }

    private async initSfdxProject() {
        const sfdxProjectConfig = await readSfdxProjectConfig(this.workspaceRoot);

        // initializing the packageDirs glob pattern prefix
        const packageDirs = getSfdxPackageDirs(sfdxProjectConfig);
        sfdxProjectConfig.sfdxPackageDirsPattern = packageDirs.join();
        if (packageDirs.length > 1) {
            // {} brackets are only needed if there are multiple paths
            sfdxProjectConfig.sfdxPackageDirsPattern = `{${sfdxProjectConfig.sfdxPackageDirsPattern}}`;
        }
        return sfdxProjectConfig;
    }

    private async writeTypings() {
        let typingsDir: string;

        switch (this.type) {
            case WorkspaceType.SFDX:
                typingsDir = join(this.workspaceRoot, '.sfdx', 'typings', 'lwc');
                break;
            case WorkspaceType.CORE_SINGLE_PROJECT:
                typingsDir = join(this.workspaceRoot, '..', '.vscode', 'typings', 'lwc');
                break;
            case WorkspaceType.CORE_ALL:
                typingsDir = join(this.workspaceRoot, '.vscode', 'typings', 'lwc');
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

    private async writeJsconfigJson() {
        let jsConfigTemplate: string;
        let jsConfigContent: string;
        const relativeModulesDirs = await this.getRelativeModulesDirs();

        switch (this.type) {
            case WorkspaceType.SFDX:
                jsConfigTemplate = await fs.readFile(utils.getSfdxResource('jsconfig-sfdx.json'), 'utf8');
                const eslintrcTemplate = await fs.readFile(utils.getSfdxResource('eslintrc-sfdx.json'), 'utf8');
                const forceignore = join(this.workspaceRoot, '.forceignore');
                for (const relativeModulesDir of relativeModulesDirs) {
                    // write/update jsconfig.json
                    const relativeJsConfigPath = join(relativeModulesDir, 'jsconfig.json');
                    const jsConfigPath = join(this.workspaceRoot, relativeJsConfigPath);
                    const relativeWorkspaceRoot = utils.relativePath(path.dirname(jsConfigPath), this.workspaceRoot);
                    jsConfigContent = this.processTemplate(jsConfigTemplate, { project_root: relativeWorkspaceRoot });
                    this.updateConfigFile(relativeJsConfigPath, jsConfigContent);
                    // write/update .eslintrc.json
                    const relativeEslintrcPath = join(relativeModulesDir, '.eslintrc.json');
                    this.updateConfigFile(relativeEslintrcPath, eslintrcTemplate);
                    await this.updateForceIgnoreFile(forceignore);
                }
                break;

            case WorkspaceType.CORE_ALL:
                jsConfigTemplate = await fs.readFile(utils.getCoreResource('jsconfig-core.json'), 'utf8');
                jsConfigContent = this.processTemplate(jsConfigTemplate, { project_root: '../..' });
                for (const relativeModulesDir of relativeModulesDirs) {
                    const relativeJsConfigPath = join(relativeModulesDir, 'jsconfig.json');
                    this.updateConfigFile(relativeJsConfigPath, jsConfigContent);
                }
                break;

            case WorkspaceType.CORE_SINGLE_PROJECT:
                jsConfigTemplate = await fs.readFile(utils.getCoreResource('jsconfig-core.json'), 'utf8');
                jsConfigContent = this.processTemplate(jsConfigTemplate, { project_root: '../..' });
                for (const relativeModulesDir of relativeModulesDirs) {
                    const relativeJsConfigPath = join(relativeModulesDir, 'jsconfig.json');
                    this.updateConfigFile(relativeJsConfigPath, jsConfigContent);
                }
                break;
        }
    }

    private async writeSettings() {
        switch (this.type) {
            case WorkspaceType.SFDX:
                break;

            case WorkspaceType.CORE_ALL:
                // updateCoreSettings is performed by core's setupVSCode
                await this.updateCoreCodeWorkspace();
                await this.updateCoreLaunch();
                break;

            case WorkspaceType.CORE_SINGLE_PROJECT:
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
        await fs.ensureDir(join(this.workspaceRoot, '.vscode'));
        this.updateConfigFile(join('.vscode', 'settings.json'), templateContent);
    }

    private async updateCoreCodeWorkspace() {
        const configBlt = await this.readConfigBlt();
        const variableMap = {
            eslint_node_path: await findCoreESLint(),
            p4_port: configBlt['p4.port'],
            p4_client: configBlt['p4.client'],
            p4_user: configBlt['p4.user'],
            java_home: configBlt['eclipse.default.jdk'],
            workspace_root: utils.unixify(this.workspaceRoot),
        };
        const templateString = await fs.readFile(utils.getCoreResource('core.code-workspace.json'), 'utf8');
        const templateContent = this.processTemplate(templateString, variableMap);
        this.updateConfigFile('core.code-workspace', templateContent);
    }

    private async readConfigBlt() {
        const isMain = this.workspaceRoot.indexOf(join('main', 'core')) !== -1;
        let relativeBltDir = isMain ? join('..', '..', '..') : join('..', '..', '..', '..');
        if (this.type === WorkspaceType.CORE_SINGLE_PROJECT) {
            relativeBltDir = join(relativeBltDir, '..');
        }
        const configBltContent = await fs.readFile(join(this.workspaceRoot, relativeBltDir, 'config.blt'), 'utf8');
        return parse(configBltContent);
    }

    private async updateCoreLaunch() {
        const launchContent = await fs.readFile(utils.getCoreResource('launch-core.json'), 'utf8');
        await fs.ensureDir(join(this.workspaceRoot, '.vscode'));
        const relativeLaunchPath = join('.vscode', 'launch.json');
        this.updateConfigFile(relativeLaunchPath, launchContent);
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
     * Adds to the config file in 'relativeConfigPath' any missing properties in 'config'
     * (existing properties are not updated)
     */
    private updateConfigFile(relativeConfigPath: string, config: string) {
        // note: we don't want to use async file i/o here, because we don't want another task
        // to interleve with reading/writing this file
        const configFile = join(this.workspaceRoot, relativeConfigPath);
        try {
            const configJson = JSON.parse(config);
            if (!fs.pathExistsSync(configFile)) {
                utils.writeJsonSync(configFile, configJson);
            } else {
                try {
                    const fileConfig = utils.readJsonSync(configFile);
                    if (utils.deepMerge(fileConfig, configJson)) {
                        utils.writeJsonSync(configFile, fileConfig);
                    }
                } catch (e) {
                    // misformed file, write out fresh one
                    utils.writeJsonSync(configFile, configJson);
                }
            }
        } catch (error) {
            console.warn('Error updating ' + configFile, error);
        }
    }

    private async updateForceIgnoreFile(ignoreFile: string) {
        await utils.appendLineIfMissing(ignoreFile, '**/jsconfig.json');
        await utils.appendLineIfMissing(ignoreFile, '**/.eslintrc.json');
    }

    private async findNamespaceRootsUsingType(): Promise<{ lwc: string[]; aura: string[] }> {
        const roots: { lwc: string[]; aura: string[] } = {
            lwc: [],
            aura: [],
        };
        switch (this.type) {
            case WorkspaceType.SFDX:
                // optimization: search only inside package directories
                const { packageDirectories } = await this.getSfdxProjectConfig();
                for (const pkg of packageDirectories) {
                    const pkgDir = join(this.workspaceRoot, pkg.path);
                    const subroots = await findNamespaceRoots(pkgDir);
                    roots.lwc.push(...subroots.lwc);
                    roots.aura.push(...subroots.aura);
                }
                return roots;
            case WorkspaceType.CORE_ALL:
                // optimization: search only inside project/modules/
                for (const project of await fs.readdir(this.workspaceRoot)) {
                    const modulesDir = join(this.workspaceRoot, project, 'modules');
                    if (await fs.pathExists(modulesDir)) {
                        const subroots = await findNamespaceRoots(modulesDir, 2);
                        roots.lwc.push(...subroots.lwc);
                    }
                    const auraDir = join(this.workspaceRoot, project, 'components');
                    if (await fs.pathExists(auraDir)) {
                        const subroots = await findNamespaceRoots(auraDir, 2);
                        roots.aura.push(...subroots.aura);
                    }
                }
                return roots;
            case WorkspaceType.CORE_SINGLE_PROJECT:
                // optimization: search only inside modules/
                const coreroots = await findNamespaceRoots(join(this.workspaceRoot, 'modules'), 2);
                roots.lwc.push(...coreroots.lwc);
                roots.aura.push(...coreroots.aura);
                return roots;
            case WorkspaceType.STANDARD:
            case WorkspaceType.STANDARD_LWC:
            case WorkspaceType.MONOREPO:
            case WorkspaceType.UNKNOWN: {
                let depth = 6;
                if (this.type === WorkspaceType.MONOREPO) {
                    depth += 2;
                }
                const unknownroots = await findNamespaceRoots(this.workspaceRoot, depth);
                roots.lwc.push(...unknownroots.lwc);
                roots.aura.push(...unknownroots.aura);
                return roots;
            }
        }
        return roots;
    }
}

async function readSfdxProjectConfig(workspaceRoot: string): Promise<ISfdxProjectConfig> {
    try {
        return JSON.parse(await fs.readFile(getSfdxProjectFile(workspaceRoot), 'utf8'));
    } catch (e) {
        throw new Error(`Sfdx project file seems invalid. Unable to parse ${getSfdxProjectFile(workspaceRoot)}. ${e.message}`);
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
        return '/core/eslint-tool/not-installed/run/mvn/tools/eslint-lwc';
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
