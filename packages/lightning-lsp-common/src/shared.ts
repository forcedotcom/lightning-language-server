// utility methods shared with the vscode extension
import * as fs from 'fs';
import * as path from 'path';

const SFDX_PROJECT = 'sfdx-project.json';

export const WorkspaceTypes = {
    /** standard workspace with a package.json but no lwc dependencies */
    STANDARD: 'STANDARD',
    /** standard workspace with a package.json and lwc dependencies */
    STANDARD_LWC: 'STANDARD_LWC',
    /** monorepo workspace, using monorepo strucutre */
    MONOREPO: 'MONOREPO',
    /** monorepo workspace, using monorepo strucutre, and lwc dependencies */
    MONOREPO_LWC: 'MONOREPO_LWC',
    /** sfdx workspace */
    SFDX: 'SFDX',
    /** workspace including all core projects */
    CORE_ALL: 'CORE_ALL',
    /** workspace including only one or more core projects */
    CORE_PARTIAL: 'CORE_PARTIAL',
    UNKNOWN: 'UNKNOWN',
};

export type WorkspaceType = (typeof WorkspaceTypes)[keyof typeof WorkspaceTypes];

export const isLWC = (type: WorkspaceType): boolean => {
    return type === WorkspaceTypes.SFDX || type === WorkspaceTypes.STANDARD_LWC || type === WorkspaceTypes.CORE_ALL || type === WorkspaceTypes.CORE_PARTIAL;
};

export const getSfdxProjectFile = (root: string): string => {
    return path.join(root, SFDX_PROJECT);
};

/**
 * @param root
 * @returns WorkspaceType for singular root
 */
export const detectWorkspaceHelper = (root: string): WorkspaceType => {
    if (fs.existsSync(getSfdxProjectFile(root))) {
        return WorkspaceTypes.SFDX;
    }
    if (fs.existsSync(path.join(root, 'workspace-user.xml'))) {
        return WorkspaceTypes.CORE_ALL;
    }
    if (fs.existsSync(path.join(root, '..', 'workspace-user.xml'))) {
        return WorkspaceTypes.CORE_PARTIAL;
    }

    if (fs.existsSync(path.join(root, 'lwc.config.json'))) {
        return WorkspaceTypes.STANDARD_LWC;
    }

    const packageJson = path.join(root, 'package.json');
    if (fs.existsSync(packageJson)) {
        try {
            const packageInfo = JSON.parse(fs.readFileSync(packageJson, 'utf-8'));
            const dependencies = Object.keys(packageInfo.dependencies || {});
            const devDependencies = Object.keys(packageInfo.devDependencies || {});
            const allDependencies = [...dependencies, ...devDependencies];
            const hasLWCdependencies = allDependencies.some((key) => {
                return key.startsWith('@lwc/') || key === 'lwc';
            });

            // any type of @lwc is a dependency
            if (hasLWCdependencies) {
                return WorkspaceTypes.STANDARD_LWC;
            }

            // has any type of lwc configuration
            if (packageInfo.lwc) {
                return WorkspaceTypes.STANDARD_LWC;
            }

            if (packageInfo.workspaces) {
                return WorkspaceTypes.MONOREPO;
            }

            if (fs.existsSync(path.join(root, 'lerna.json'))) {
                return WorkspaceTypes.MONOREPO;
            }

            return WorkspaceTypes.STANDARD;
        } catch (e) {
            // Log error and fallback to setting workspace type to Unknown
            console.error(`Error encountered while trying to detect workspace type ${e}`);
        }
    }

    console.error('unknown workspace type:', root);
    return WorkspaceTypes.UNKNOWN;
};

/**
 * @param workspaceRoots
 * @returns WorkspaceType, actively not supporting workspaces of mixed type
 */
export const detectWorkspaceType = (workspaceRoots: string[]): WorkspaceType => {
    if (workspaceRoots.length === 1) {
        return detectWorkspaceHelper(workspaceRoots[0]);
    }
    for (const root of workspaceRoots) {
        const type = detectWorkspaceHelper(root);
        if (type !== WorkspaceTypes.CORE_PARTIAL) {
            console.error('unknown workspace type');
            return WorkspaceTypes.UNKNOWN;
        }
    }
    return WorkspaceTypes.CORE_PARTIAL;
};
