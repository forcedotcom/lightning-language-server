import * as fs from 'fs-extra';
import * as path from 'path';
import * as os from 'os';
import * as semver from 'semver';
import { join } from 'path';
import * as utils from './utils';
import { indexCustomLabels } from './metadata-utils/custom-labels-util';
import { indexStaticResources } from './metadata-utils/static-resources-util';
import { loadStandardComponents, indexCustomComponents } from './metadata-utils/custom-components-util';
import { TextDocument } from 'vscode-languageserver';
import { WorkspaceType, detectWorkspaceType, isLWC } from './shared';
import { GlobSync } from 'glob';
import * as _ from 'lodash';

/**
 * Holds information and utility methods for a LWC workspace
 */
export class WorkspaceContext {

    // fields common to all projec types
    public readonly type: WorkspaceType;
    public readonly workspaceRoot: string;
    public readonly namespaceRoots: string[];

    // fields for sfdx projects
    private sfdxProjectConfig: ISfdxProjectConfig;
    private sfdxPackageDirsPattern: string;

    /**
     * Creates a new WorkspaceContext representing the workspace at workspaceRoot
     */
    public constructor(workspaceRoot: string) {
        this.workspaceRoot = path.resolve(workspaceRoot);
        this.type = detectWorkspaceType(workspaceRoot);
        if (this.type === WorkspaceType.SFDX) {
            this.initSfdxProject();
        }
        if (!isLWC(this.type)) {
            console.error('not a LWC workspace:', workspaceRoot);
        }
        this.namespaceRoots = this.findNamespaceRootsUsingType();
    }

    public async configureAndIndex() {
        this.configureProject();

        // indexing:
        const indexingTasks: Array<Promise<void>> = [];
        if (this.type !== WorkspaceType.STANDARD_LWC) {
            indexingTasks.push(loadStandardComponents());
        }
        indexingTasks.push(indexCustomComponents(this));
        if (this.type === WorkspaceType.SFDX) {
            indexingTasks.push(indexStaticResources(this.workspaceRoot, this.sfdxPackageDirsPattern));
            indexingTasks.push(indexCustomLabels(this.workspaceRoot, this.sfdxPackageDirsPattern));
        }
        await Promise.all(indexingTasks);
    }

    /**
     * Find all return all the .js module files in the workspace
     */
    public findAllModules(): string[] {
        const files: string[] = [];
        this.namespaceRoots.forEach((namespaceRoot) => {
            files.push.apply(files, findModulesIn(namespaceRoot));
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
        if (!file.startsWith(this.workspaceRoot)) {
            throw new Error('document not in workspace: ' + file + '\n' + this.workspaceRoot);
        }

        for (const root of this.namespaceRoots) {
            if (file.startsWith(root)) {
                return true;
            }
        }
        return false;
        // TODO: optimize by switching namespaceRoots to moduleRoots
    }

    /**
     * Configures a sfdx project
     */
    public configureProject() {
        this.writeConfigFiles();
        this.writeTypings();
    }

    private writeTypings() {
        let typingsDir: string;

        switch (this.type) {
            case WorkspaceType.SFDX:
                typingsDir = join(this.workspaceRoot, '.sfdx', 'typings', 'lwc');
                break;
            case WorkspaceType.CORE_PROJECT:
                typingsDir = join(this.workspaceRoot, '..', '.vscode', 'typings', 'lwc');
                break;
            case WorkspaceType.CORE_ALL:
                typingsDir = join(this.workspaceRoot, '.vscode', 'typings', 'lwc');
                break;
        }

        if (typingsDir) {
            // copy engine.d.ts, lwc.d.ts to typingsDir
            fs.ensureDir(typingsDir);
            fs.copySync(utils.getSfdxResource(join('typings', 'engine.d.ts')), join(typingsDir, 'engine.d.ts'));
            fs.copySync(utils.getSfdxResource(join('typings', 'lwc.d.ts')), join(typingsDir, 'lwc.d.ts'));
        }
    }

    private writeConfigFiles() {
        if (this.type === WorkspaceType.SFDX) {
            const jsConfigTemplate = fs.readFileSync(utils.getSfdxResource('jsconfig-sfdx.json'), 'utf8');
            const eslintrcTemplate = fs.readFileSync(utils.getSfdxResource('eslintrc-sfdx.json'), 'utf8');

            const forceignore = join(this.workspaceRoot, '.forceignore');
            new GlobSync(`${this.sfdxPackageDirsPattern}/**/lightningcomponents/`, { cwd: this.workspaceRoot }).found.forEach(dirPath => {
                // write/update jsconfig.json
                const relativeJsConfigPath = join(dirPath, 'jsconfig.json');
                const jsConfigPath = join(this.workspaceRoot, relativeJsConfigPath);
                const relativeWorkspaceRoot = path.relative(path.dirname(jsConfigPath), this.workspaceRoot);
                const jsConfigContent = this.processTemplate(jsConfigTemplate, relativeWorkspaceRoot);
                this.updateConfigFile(relativeJsConfigPath, jsConfigContent, forceignore);

                // write/update .eslintrc.json
                const relativeEslintrcPath = join(dirPath, '.eslintrc.json');
                this.updateConfigFile(relativeEslintrcPath, eslintrcTemplate, forceignore);
            });
        }

        if (this.type === WorkspaceType.CORE_PROJECT) {
            const jsConfigTemplate = fs.readFileSync(utils.getCoreResource('jsconfig-core.json'), 'utf8');
            const relativeJsConfigPath = join('modules', 'jsconfig.json');
            const jsConfigContent = this.processTemplate(jsConfigTemplate, '../..');
            this.updateConfigFile(relativeJsConfigPath, jsConfigContent);
            this.updateCoreSettings();
        }

        if (this.type === WorkspaceType.CORE_ALL) {
            const jsConfigTemplate = fs.readFileSync(utils.getCoreResource('jsconfig-core.json'), 'utf8');
            const jsConfigContent = this.processTemplate(jsConfigTemplate, '../..');
            for (const project of fs.readdirSync(this.workspaceRoot)) {
                const modulesDir = join(project, 'modules');
                if (fs.existsSync(join(this.workspaceRoot, modulesDir))) {
                    const relativeJsConfigPath = join(modulesDir, 'jsconfig.json');
                    this.updateConfigFile(relativeJsConfigPath, jsConfigContent);
                }
            }
            this.updateCoreSettings();
        }
    }

    private updateCoreSettings() {
        const settingsTemplate = fs.readFileSync(utils.getCoreResource('settings-core.json'), 'utf8');
        const settingsContent = this.processTemplate(settingsTemplate, undefined, findCoreESLint());
        fs.ensureDir(join(this.workspaceRoot, '.vscode'));
        const relativeSettingsPath = join('.vscode', 'settings.json');
        this.updateConfigFile(relativeSettingsPath, settingsContent);
    }

    private processTemplate(template: string, relativeWorkspaceRoot: string, eslintNodePath?: string) {
        _.templateSettings.interpolate = /\${([\s\S]+?)}/g;
        const compiled = _.template(template);
        const variableMap: { project_root: string, eslint_node_path?: string} = { project_root: relativeWorkspaceRoot};
        if (eslintNodePath) {
            variableMap.eslint_node_path = eslintNodePath;
        }
        return compiled(variableMap);
    }

    private updateConfigFile(relativeConfigPath: string, config: string, ignoreFile?: string) {
        const configFile = join(this.workspaceRoot, relativeConfigPath);
        const configJson = JSON.parse(config);
        if (!fs.existsSync(configFile)) {
            fs.writeFileSync(configFile, JSON.stringify(configJson, null, 4));
        } else {
            const fileConfig = JSON.parse(fs.readFileSync(configFile).toString());
            if (utils.deepMerge(fileConfig, configJson)) {
                fs.writeFileSync(configFile, JSON.stringify(fileConfig, null, 4));
            }
        }
        if (ignoreFile) {
            utils.appendLineIfMissing(ignoreFile, relativeConfigPath);
        }
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

    private findNamespaceRootsUsingType() {
        const roots: string[] = [];
        switch (this.type) {
            case WorkspaceType.SFDX:
                // optimization: search only inside package directories
                for (const pkg of this.sfdxProjectConfig.packageDirectories) {
                    const pkgDir = join(this.workspaceRoot, pkg.path);
                    for (const root of findNamespaceRoots(pkgDir)) {
                        roots.push(root);
                    }
                }
                return roots;
            case WorkspaceType.CORE_ALL:
                // optimization: search only inside project/modules/
                for (const project of fs.readdirSync(this.workspaceRoot)) {
                    const modulesDir = join(this.workspaceRoot, project, 'modules');
                    if (fs.existsSync(modulesDir)) {
                        for (const root of findNamespaceRoots(modulesDir, 2)) {
                            roots.push(root);
                        }
                    }
                }
                return roots;
            case WorkspaceType.CORE_PROJECT:
                // optimization: search only inside modules/
                return findNamespaceRoots(join(this.workspaceRoot, 'modules'), 2);
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
    return JSON.parse(fs.readFileSync(join(workspaceRoot, 'sfdx-project.json'), 'utf8'));
}

function getSfdxPackageDirs(sfdxProjectConfig: ISfdxProjectConfig) {
    const packageDirs: string[] = [];
    sfdxProjectConfig.packageDirectories.forEach((packageDir) => {
        packageDirs.push(packageDir.path);
    });
    return packageDirs;
}

/**
 * @param root directory to start searching from
 * @return module namespaces root folders found inside 'root'
 */
function findNamespaceRoots(root: string, maxDepth: number = 5): string[] {
    const roots: string[] = [];

    function isModuleRoot(subdirs: string[]): boolean {
        // is a root if any subdir matches a name/name.js with name.js being a module
        for (const subdir of subdirs) {
            const basename = path.basename(subdir);
            const modulePath = path.join(subdir, basename + '.js');
            if (fs.existsSync(modulePath) && fs.existsSync(path.join(subdir, basename + '.html'))) {
                // TODO: check contents for: from 'engine'?
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
        if (filename === 'node_modules' || filename === 'bin' || filename === 'target'
            || filename === 'jest-modules' || filename === 'components' || filename === 'repository') {
            return;
        }

        // module_root/name/name.js

        const subdirs = findSubdirectories(candidate);
        if (isModuleRoot(subdirs)) {
            roots.push(path.resolve(candidate));
        } else {
            for (const subdir of subdirs) {
                traverse(subdir, depth);
            }
        }
    }

    traverse(root, maxDepth);
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
        if (fs.existsSync(modulePath) && fs.existsSync(path.join(subdir, basename + '.html'))) {
            // TODO: check contents for: from 'engine'?
            files.push(modulePath);
        }
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
    const homedir = os.homedir();
    const eslintToolDir = path.join(homedir, 'tools', 'eslint-tool');
    if (!fs.existsSync(eslintToolDir)) {
        console.warn('core eslint-tool not installed: ' + eslintToolDir);
        return '/core/eslint-tool/not-installed/run/mvn/tools/eslint-lwc';
    }
    let highestVersion;
    for (const file of fs.readdirSync(eslintToolDir)) {
        const subdir = path.join(eslintToolDir, file);
        if (fs.statSync(subdir).isDirectory()) {
            if (!highestVersion || semver.lt(highestVersion, file)) {
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
