import * as fs from 'fs-extra';
import { GlobSync } from 'glob';
import glob from 'glob';
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

export interface Indexer {
    configureAndIndex(): Promise<void>;
}
/**
 * Holds information and utility methods for a LWC workspace
 */
export class WorkspaceContext {
    // common to all project types
    public readonly type: WorkspaceType;
    public readonly workspaceRoot: string;
    public namespaceRoots: { lwc: string[]; aura: string[] };
    public indexers: Map<string, Indexer> = new Map();
    public sfdxPackageDirsPattern: string;

    // for sfdx projectsÍ
    private sfdxProjectConfig: ISfdxProjectConfig;
    /**
     * @return WorkspaceContext representing the workspace at workspaceRoot
     */
    public constructor(workspaceRoot: string) {
        this.workspaceRoot = path.resolve(workspaceRoot);
        this.type = detectWorkspaceType(workspaceRoot);
        if (this.type === WorkspaceType.SFDX) {
            this.initSfdxProject();
        }
        if (!isLWC(this.type)) {
            console.error('not a LWC workspace:', this.workspaceRoot);
        }
        this.namespaceRoots = this.findNamespaceRootsUsingType();
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
    public findAllModules(): string[] {
        const files: string[] = [];
        this.namespaceRoots.lwc.forEach(namespaceRoot => {
            files.push.apply(files, findModulesIn(namespaceRoot));
        });
        return files;
    }

    public findAllAuraMarkup(): string[] {
        const files: string[] = [];
        this.namespaceRoots.aura.forEach(namespaceRoot => {
            files.push.apply(files, findAuraMarkupIn(namespaceRoot));
        });
        return files;
    }

    public isLWCTemplate(document: TextDocument): boolean {
        return document.languageId === 'html' && utils.getExtension(document) === '.html' && this.isInsideModulesRoots(document);
    }

    public isLWCJavascript(document: TextDocument): boolean {
        return document.languageId === 'javascript' && this.isInsideModulesRoots(document);
    }
    public isInsideModulesRoots(document: TextDocument): boolean {
        const file = utils.toResolvedPath(document.uri);
        if (!utils.pathStartsWith(file, this.workspaceRoot)) {
            throw new Error('document not in workspace: ' + file + '\n' + this.workspaceRoot);
        }
        return this.isFileInsideModulesRoots(file);
    }

    public isFileInsideModulesRoots(file: string): boolean {
        for (const root of this.namespaceRoots.lwc) {
            if (utils.pathStartsWith(file, root)) {
                return true;
            }
        }
        return false;
    }

    public isFileInsideAuraRoots(file: string): boolean {
        for (const root of this.namespaceRoots.aura) {
            if (utils.pathStartsWith(file, root)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Configures a LWC project
     */
    public configureProject() {
        this.namespaceRoots = this.findNamespaceRootsUsingType();
        this.writeJsconfigJson();
        this.writeSettings();
        this.writeTypings();
    }

    /**
     * @return list of relative paths to LWC modules directories
     */
    public getRelativeModulesDirs(): string[] {
        const list: string[] = [];
        switch (this.type) {
            case WorkspaceType.SFDX:
                new GlobSync(`${this.sfdxPackageDirsPattern}/**/lwc/`, { cwd: this.workspaceRoot }).found.forEach(dirPath => {
                    list.push(dirPath);
                });
                break;

            case WorkspaceType.CORE_ALL:
                for (const project of fs.readdirSync(this.workspaceRoot)) {
                    const modulesDir = join(project, 'modules');
                    if (fs.existsSync(join(this.workspaceRoot, modulesDir))) {
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

    private writeTypings() {
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
            fs.ensureDirSync(typingsDir);
            fs.copySync(join(resourceTypingsDir, 'lds.d.ts'), join(typingsDir, 'lds.d.ts'));
            for (const file of fs.readdirSync(join(resourceTypingsDir, 'copied'))) {
                fs.copySync(join(resourceTypingsDir, 'copied', file), join(typingsDir, file));
            }
        }
    }

    private writeJsconfigJson() {
        let jsConfigTemplate: string;
        let jsConfigContent: string;
        const relativeModulesDirs = this.getRelativeModulesDirs();

        switch (this.type) {
            case WorkspaceType.SFDX:
                jsConfigTemplate = utils.readFileSync(utils.getSfdxResource('jsconfig-sfdx.json'));
                const eslintrcTemplate = utils.readFileSync(utils.getSfdxResource('eslintrc-sfdx.json'));
                const forceignore = join(this.workspaceRoot, '.forceignore');
                relativeModulesDirs.forEach(relativeModulesDir => {
                    // write/update jsconfig.json
                    const relativeJsConfigPath = join(relativeModulesDir, 'jsconfig.json');
                    const jsConfigPath = join(this.workspaceRoot, relativeJsConfigPath);
                    const relativeWorkspaceRoot = utils.relativePath(path.dirname(jsConfigPath), this.workspaceRoot);
                    jsConfigContent = this.processTemplate(jsConfigTemplate, { project_root: relativeWorkspaceRoot });
                    this.updateConfigFile(relativeJsConfigPath, jsConfigContent);
                    // write/update .eslintrc.json
                    const relativeEslintrcPath = join(relativeModulesDir, '.eslintrc.json');
                    this.updateConfigFile(relativeEslintrcPath, eslintrcTemplate);
                    this.updateForceIgnoreFile(forceignore);
                });
                break;

            case WorkspaceType.CORE_ALL:
                jsConfigTemplate = utils.readFileSync(utils.getCoreResource('jsconfig-core.json'));
                jsConfigContent = this.processTemplate(jsConfigTemplate, { project_root: '../..' });
                relativeModulesDirs.forEach(relativeModulesDir => {
                    const relativeJsConfigPath = join(relativeModulesDir, 'jsconfig.json');
                    this.updateConfigFile(relativeJsConfigPath, jsConfigContent);
                });
                break;

            case WorkspaceType.CORE_SINGLE_PROJECT:
                jsConfigTemplate = utils.readFileSync(utils.getCoreResource('jsconfig-core.json'));
                jsConfigContent = this.processTemplate(jsConfigTemplate, { project_root: '../..' });
                relativeModulesDirs.forEach(relativeModulesDir => {
                    const relativeJsConfigPath = join(relativeModulesDir, 'jsconfig.json');
                    this.updateConfigFile(relativeJsConfigPath, jsConfigContent);
                });
                break;
        }
    }

    private writeSettings() {
        switch (this.type) {
            case WorkspaceType.SFDX:
                this.updateWorkspaceSettings();
                break;

            case WorkspaceType.CORE_ALL:
                this.updateWorkspaceSettings();
                // updateCoreSettings is performed by core's setupVSCode
                this.updateCoreCodeWorkspace();
                this.updateCoreLaunch();
                break;

            case WorkspaceType.CORE_SINGLE_PROJECT:
                this.updateWorkspaceSettings();
                this.updateCoreSettings();
                break;

            default:
                this.updateWorkspaceSettings();
                break;
        }
    }

    private writeJsconfig(file: string, jsconfig: {}) {
        utils.writeFileSync(file, JSON.stringify(jsconfig, null, 4));
    }

    private updateCoreSettings() {
        const configBlt = this.readConfigBlt();
        const variableMap = {
            eslint_node_path: findCoreESLint(),
            p4_port: configBlt['p4.port'],
            p4_client: configBlt['p4.client'],
            p4_user: configBlt['p4.user'],
        };
        const templateString = utils.readFileSync(utils.getCoreResource('settings-core.json'));
        const templateContent = this.processTemplate(templateString, variableMap);
        fs.ensureDirSync(join(this.workspaceRoot, '.vscode'));
        this.updateConfigFile(join('.vscode', 'settings.json'), templateContent);
    }

    private updateCoreCodeWorkspace() {
        const configBlt = this.readConfigBlt();
        const variableMap = {
            eslint_node_path: findCoreESLint(),
            p4_port: configBlt['p4.port'],
            p4_client: configBlt['p4.client'],
            p4_user: configBlt['p4.user'],
            java_home: configBlt['eclipse.default.jdk'],
            workspace_root: utils.unixify(this.workspaceRoot),
        };
        const templateString = utils.readFileSync(utils.getCoreResource('core.code-workspace.json'));
        const templateContent = this.processTemplate(templateString, variableMap);
        this.updateConfigFile('core.code-workspace', templateContent);
    }

    private readConfigBlt() {
        const isMain = this.workspaceRoot.indexOf(join('main', 'core')) !== -1;
        let relativeBltDir = isMain ? join('..', '..', '..') : join('..', '..', '..', '..');
        if (this.type === WorkspaceType.CORE_SINGLE_PROJECT) {
            relativeBltDir = join(relativeBltDir, '..');
        }
        const configBltContent = utils.readFileSync(join(this.workspaceRoot, relativeBltDir, 'config.blt'));
        return parse(configBltContent);
    }

    private updateCoreLaunch() {
        const launchContent = utils.readFileSync(utils.getCoreResource('launch-core.json'));
        fs.ensureDirSync(join(this.workspaceRoot, '.vscode'));
        const relativeLaunchPath = join('.vscode', 'launch.json');
        this.updateConfigFile(relativeLaunchPath, launchContent);
    }

    /**
     * Updates common workspace settings that apply to any LWC project.
     * See src/resources/common/settings.json
     */
    private updateWorkspaceSettings() {
        const settingsContent = utils.readFileSync(utils.getResourcePath(join('common', 'settings.json')));
        fs.ensureDirSync(join(this.workspaceRoot, '.vscode'));
        const relativeSettingsPath = join('.vscode', 'settings.json');
        this.updateConfigFile(relativeSettingsPath, settingsContent);
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
        const configFile = join(this.workspaceRoot, relativeConfigPath);
        try {
            const configJson = JSON.parse(config);
            if (!fs.existsSync(configFile)) {
                this.writeJsconfig(configFile, configJson);
            } else {
                const fileConfig = JSON.parse(utils.readFileSync(configFile));
                if (utils.deepMerge(fileConfig, configJson)) {
                    this.writeJsconfig(configFile, fileConfig);
                }
            }
        } catch (error) {
            throw new Error('error updating ' + configFile + ': ' + error);
        }
    }

    private updateForceIgnoreFile(ignoreFile: string) {
        utils.appendLineIfMissing(ignoreFile, '**/jsconfig.json');
        utils.appendLineIfMissing(ignoreFile, '**/.eslintrc.json');
    }

    private initSfdxProject() {
        this.sfdxProjectConfig = readSfdxProjectConfig(this.workspaceRoot);

        // initializing the packageDirs glob pattern prefix
        const packageDirs = getSfdxPackageDirs(this.sfdxProjectConfig);
        this.sfdxPackageDirsPattern = packageDirs.join();
        if (packageDirs.length > 1) {
            // {} brackets are only needed if there are multiple paths
            this.sfdxPackageDirsPattern = `{${this.sfdxPackageDirsPattern}}`;
        }
    }

    private findNamespaceRootsUsingType(): { lwc: string[]; aura: string[] } {
        const roots: { lwc: string[]; aura: string[] } = {
            lwc: [],
            aura: [],
        };
        switch (this.type) {
            case WorkspaceType.SFDX:
                // optimization: search only inside package directories
                for (const pkg of this.sfdxProjectConfig.packageDirectories) {
                    const pkgDir = join(this.workspaceRoot, pkg.path);
                    const subroots = findNamespaceRoots(pkgDir);
                    roots.lwc.push(...subroots.lwc);
                    roots.aura.push(...subroots.aura);
                }
                return roots;
            case WorkspaceType.CORE_ALL:
                // optimization: search only inside project/modules/
                for (const project of fs.readdirSync(this.workspaceRoot)) {
                    const modulesDir = join(this.workspaceRoot, project, 'modules');
                    if (fs.existsSync(modulesDir)) {
                        const subroots = findNamespaceRoots(modulesDir, 2);
                        roots.lwc.push(...subroots.lwc);
                    }
                    const auraDir = join(this.workspaceRoot, project, 'components');
                    if (fs.existsSync(auraDir)) {
                        const subroots = findNamespaceRoots(auraDir, 2);
                        roots.aura.push(...subroots.aura);
                    }
                }
                return roots;
            case WorkspaceType.CORE_SINGLE_PROJECT:
                // optimization: search only inside modules/
                roots.lwc.push(...findNamespaceRoots(join(this.workspaceRoot, 'modules'), 2).lwc);
                roots.aura.push(...findNamespaceRoots(join(this.workspaceRoot, 'components'), 2).aura);
                return roots;
            case WorkspaceType.STANDARD_LWC:
            case WorkspaceType.UNKNOWN:
                return findNamespaceRoots(this.workspaceRoot);
        }
    }
}

interface ISfdxPackageDirectoryConfig {
    path: string;
}

interface ISfdxProjectConfig {
    packageDirectories: ISfdxPackageDirectoryConfig[];
}

function readSfdxProjectConfig(workspaceRoot: string): ISfdxProjectConfig {
    try {
        return JSON.parse(utils.readFileSync(getSfdxProjectFile(workspaceRoot)));
    } catch (e) {
        throw new Error(`Sfdx project file seems invalid. Unable to parse ${getSfdxProjectFile(workspaceRoot)}. ${e.message}`);
    }
}

function getSfdxPackageDirs(sfdxProjectConfig: ISfdxProjectConfig) {
    const packageDirs: string[] = [];
    sfdxProjectConfig.packageDirectories.forEach(packageDir => {
        packageDirs.push(packageDir.path);
    });
    return packageDirs;
}

/**
 * @param root directory to start searching from
 * @return module namespaces root folders found inside 'root'
 */
function findNamespaceRoots(root: string, maxDepth: number = 5): { lwc: string[]; aura: string[] } {
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

    function isAuraRoot(subdirs: string[]): boolean {
        for (const subdir of subdirs) {
            // Is a root if any subdir matches a name/name.js with name.js being a module
            const basename = path.basename(subdir);
            const componentPath = path.join(subdir, basename + '@(.app|.cmp|.intf|.evt|.lib)');
            const files = glob.sync(componentPath, { cwd: subdir });
            if (files.length > 0) {
                return true;
            }
        }
        return false;
    }

    function traverse(candidate: string, depth: number): void {
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

        const subdirs = findSubdirectories(candidate);
        // Is a root if we have a folder called lwc
        const isDirLWC = isModuleRoot(subdirs) || (!path.parse(candidate).ext && path.parse(candidate).name === 'lwc');
        const isAura = isAuraRoot(subdirs);
        if (isAura) {
            roots.aura.push(path.resolve(candidate));
        }
        if (isDirLWC && !isAura) {
            roots.lwc.push(path.resolve(candidate));
        }
        if (!isDirLWC && !isAura) {
            for (const subdir of subdirs) {
                traverse(subdir, depth);
            }
        }
    }

    if (fs.existsSync(root)) {
        traverse(root, maxDepth);
    }
    return roots;
}

/**
 * @return list of .js modules inside namespaceRoot folder
 */
function findModulesIn(namespaceRoot: string): string[] {
    const files: string[] = [];
    const subdirs = findSubdirectories(namespaceRoot);
    for (const subdir of subdirs) {
        const basename = path.basename(subdir);
        const modulePath = path.join(subdir, basename + '.js');
        if (fs.existsSync(modulePath) && componentUtil.isJSComponent(modulePath)) {
            // TODO: check contents for: from 'lwc'?
            files.push(modulePath);
        }
    }
    return files;
}

/*
 * @return list of .js modules inside namespaceRoot folder
 */
function findAuraMarkupIn(namespaceRoot: string): string[] {
    const files: string[] = [];
    const subdirs = findSubdirectories(namespaceRoot);
    for (const subdir of subdirs) {
        const basename = path.basename(subdir);

        const componentPath = join(subdir, basename + '@(.app|.cmp|.intf|.evt|.lib)');
        const results = glob.sync(componentPath, { cwd: subdir });
        files.push(...results);
    }
    return files;
}

function findSubdirectories(dir: string): string[] {
    const subdirs: string[] = [];
    for (const file of fs.readdirSync(dir)) {
        const subdir = path.join(dir, file);
        if (fs.statSync(subdir).isDirectory()) {
            subdirs.push(subdir);
        }
    }
    return subdirs;
}

function findCoreESLint(): string {
    // use highest version in ~/tools/eslint-tool/{version}
    const eslintToolDir = path.join(homedir(), 'tools', 'eslint-tool');
    if (!fs.existsSync(eslintToolDir)) {
        console.warn('core eslint-tool not installed: ' + eslintToolDir);
        return '/core/eslint-tool/not-installed/run/mvn/tools/eslint-lwc';
    }
    let highestVersion;
    for (const file of fs.readdirSync(eslintToolDir)) {
        const subdir = path.join(eslintToolDir, file);
        if (fs.statSync(subdir).isDirectory()) {
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
