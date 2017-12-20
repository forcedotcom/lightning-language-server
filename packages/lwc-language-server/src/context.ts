import * as fs from 'fs-extra';
import * as path from 'path';
import { join } from 'path';
import * as utils from './utils';
import { indexCustomLabels } from './metadata-utils/custom-labels-util';
import { indexStaticResources } from './metadata-utils/static-resources-util';
import { loadStandardLwc, indexCustomComponents } from './metadata-utils/custom-components-util';
import { TextDocument } from 'vscode-languageserver';
import { GlobSync } from 'glob';
import * as _ from 'lodash';
/**
 * Holds information and utility methods for a LWC workspace
 */
export class WorkspaceContext {
    /**
     * Creates a new WorkspaceContext representing the workspace at workspaceRoot
     */
    public static createFrom(workspaceRoot: string): WorkspaceContext {
        const namespaceRoots = findNamespaceRoots(workspaceRoot);
        const sfdxProject = fs.existsSync(path.join(workspaceRoot, 'sfdx-project.json'));
        return new WorkspaceContext(workspaceRoot, sfdxProject, namespaceRoots);
    }

    private sfdxProjectConfig: ISfdxProjectConfig;
    private sfdxPackageDirsPattern: string;
    private constructor(public readonly workspaceRoot: string
                      , public readonly isSfdxProject: boolean
                      , private readonly namespaceRoots: string[]) {
        this.workspaceRoot = path.resolve(workspaceRoot);
    }

    public async configureAndIndex() {
        if (this.isSfdxProject) {
            this.configureSfdxProject();
        }

        const indexingTasks: Array<Promise<void>> = [];
        indexingTasks.push(loadStandardLwc());
        indexingTasks.push(indexCustomComponents(this));
        if (this.isSfdxProject) {
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
    public configureSfdxProject() {
        this.initSfdxProject();

        // TODO: allow user modifications in jsonfig.json
        this.writeJsonConfigFiles();

        // copy engine.d.ts, lwc.d.ts to .sfdx/typings/lwc
        const typingsDir = join(this.workspaceRoot, '.sfdx', 'typings', 'lwc');
        fs.ensureDir(typingsDir);
        fs.copySync(utils.getSfdxResource(join('typings', 'engine.d.ts')), join(typingsDir, 'engine.d.ts'));
        fs.copySync(utils.getSfdxResource(join('typings', 'lwc.d.ts')), join(typingsDir, 'lwc.d.ts'));
    }

    private writeJsonConfigFiles() {
        const jsConfigTemplate = fs.readFileSync(utils.getSfdxResource('jsconfig-sfdx.json'), 'utf8');
        _.templateSettings.interpolate = /\${([\s\S]+?)}/g;

        const compiled = _.template(jsConfigTemplate);

        const variableMap = {project_root : this.workspaceRoot };
        const jsConfigContent = compiled( variableMap );
        const forceignore = join(this.workspaceRoot, '.forceignore');
        new GlobSync(`${this.sfdxPackageDirsPattern}/**/lightningcomponents/`, {cwd: this.workspaceRoot}).found.forEach(dirPath => {
           const jsConfigPath = join(dirPath, 'jsconfig.json');
           fs.writeFileSync(join(this.workspaceRoot, jsConfigPath), jsConfigContent);
           utils.appendLineIfMissing(forceignore, jsConfigPath);
        });
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
