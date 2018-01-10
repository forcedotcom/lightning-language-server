// utility methods shared with the vscode extension

import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as semver from 'semver';

export enum WorkspaceType {
    STANDARD,
    STANDARD_LWC,
    SFDX,
    CORE_ALL,
    CORE_PROJECT,
    UNKNOWN,
}

export function isLWC(type: WorkspaceType): boolean {
    return type === WorkspaceType.SFDX || type === WorkspaceType.STANDARD_LWC || type === WorkspaceType.CORE_ALL || type === WorkspaceType.CORE_PROJECT;
}

export function detectWorkspaceType(workspaceRoot: string): WorkspaceType {
    if (fs.existsSync(path.join(workspaceRoot, 'sfdx-project.json'))) {
        return WorkspaceType.SFDX;
    }
    if (fs.existsSync(path.join(workspaceRoot, 'workspace-user.xml'))) {
        return WorkspaceType.CORE_ALL;
    }
    if (fs.existsSync(path.join(workspaceRoot, '..', 'workspace-user.xml'))) {
        return WorkspaceType.CORE_PROJECT;
    }

    const packageJson = path.join(workspaceRoot, 'package.json');
    if (fs.existsSync(packageJson)) {
        // Check if package.json contains lwc-engine
        const packageInfo = JSON.parse(fs.readFileSync(packageJson, 'utf-8'));
        const dependencies = Object.keys(packageInfo.dependencies || {});
        if (dependencies.includes('lwc-engine') || dependencies.includes('raptor-engine')) {
            return WorkspaceType.STANDARD_LWC;
        }
        const devDependencies = Object.keys(packageInfo.devDependencies || {});
        if (devDependencies.includes('lwc-engine') || devDependencies.includes('raptor-engine')) {
            return WorkspaceType.STANDARD_LWC;
        }
        return WorkspaceType.STANDARD;
    }

    console.error('unknown workspace type:', workspaceRoot);
    return WorkspaceType.UNKNOWN;
}

export function findCoreESLint(): string {
    // use highest version in ~/tools/eslint-tool/{version}
    const homedir = os.homedir();
    const eslintToolDir = path.join(homedir, 'tools', 'eslint-tool');
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
