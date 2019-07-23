// utility methods shared with the vscode extension
import * as fs from 'fs';
import * as path from 'path';

const SFDX_PROJECT: string = 'sfdx-project.json';

export enum WorkspaceType {
    /** standard workspace with a package.json but no lwc dependencies */
    STANDARD,
    /** standard workspace with a package.json and lwc dependencies */
    STANDARD_LWC,
    /** monorepo workspace, using monorepo strucutre */
    MONOREPO,
    /** monorepo workspace, using monorepo strucutre, and lwc dependencies */
    MONOREPO_LWC,
    /** sfdx workspace */
    SFDX,
    /** workspace including all core projects */
    CORE_ALL,
    /** workspace including only one or more core projects */
    CORE_PARTIAL,
    UNKNOWN,
}
export function isUnknown(type: WorkspaceType) {
    // what about core all or core single?
    switch (type) {
        case WorkspaceType.STANDARD:
        case WorkspaceType.MONOREPO_LWC:
        case WorkspaceType.MONOREPO:
        case WorkspaceType.UNKNOWN:
            return true;
    }
    return false;
}
export function isLWC(type: WorkspaceType): boolean {
    return type === WorkspaceType.SFDX || type === WorkspaceType.STANDARD_LWC || type === WorkspaceType.CORE_ALL || type === WorkspaceType.CORE_PARTIAL;
}

export function getSfdxProjectFile(root: string) {
    return path.join(root, SFDX_PROJECT);
}

/**
 * @param  {string[]} workspaceRoots
 * @returns WorkspaceType, actively not supporting workspaces of mixed type
 */
export function detectWorkspaceType(workspaceRoots: string[]): WorkspaceType {
    return detectWorkspaceHelper(workspaceRoots[0]);
    // if (workspaceRoots.length === 1) {
    //     return detectWorkspaceHelper(workspaceRoots[0]);
    // }
    // for (const root of workspaceRoots) {
    //     const type = detectWorkspaceHelper(root);
    //     if (type !== WorkspaceType.CORE_PARTIAL) {
    //         console.error('unknown workspace type');
    //         return WorkspaceType.UNKNOWN;
    //     }
    // }
    // return WorkspaceType.CORE_PARTIAL;
}

/**
 * @param  {string} root
 * @returns WorkspaceType for singular root
 */
export function detectWorkspaceHelper(root: string): WorkspaceType {
    if (fs.existsSync(getSfdxProjectFile(root))) {
        return WorkspaceType.SFDX;
    }
    if (fs.existsSync(path.join(root, 'workspace-user.xml'))) {
        return WorkspaceType.CORE_ALL;
    }
    if (fs.existsSync(path.join(root, '..', 'workspace-user.xml'))) {
        return WorkspaceType.CORE_PARTIAL;
    }

    const packageJson = path.join(root, 'package.json');
    if (fs.existsSync(packageJson)) {
        try {
            // Check if package.json contains @lwc/engine
            const packageInfo = JSON.parse(fs.readFileSync(packageJson, 'utf-8'));
            const dependencies = Object.keys(packageInfo.dependencies || {});
            if (dependencies.includes('@lwc/engine')) {
                return WorkspaceType.STANDARD_LWC;
            }
            const devDependencies = Object.keys(packageInfo.devDependencies || {});
            if (devDependencies.includes('@lwc/engine')) {
                return WorkspaceType.STANDARD_LWC;
            }
            if (packageInfo.workspaces) {
                return WorkspaceType.MONOREPO;
            }
            if (fs.existsSync(path.join(root, 'lerna.json'))) {
                return WorkspaceType.MONOREPO;
            }
            return WorkspaceType.STANDARD;
        } catch (e) {
            // Log error and fallback to setting workspace type to Unknown
            console.error(`Error encountered while trying to detect workspace type ${e}`);
        }
    }

    console.error('unknown workspace type:', root);
    return WorkspaceType.UNKNOWN;
}
