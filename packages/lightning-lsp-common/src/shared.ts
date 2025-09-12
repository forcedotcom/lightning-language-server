// utility methods shared with the vscode extension
import * as fs from 'fs';
import * as path from 'path';

const SFDX_PROJECT = 'sfdx-project.json';

export type WorkspaceType = 'STANDARD' | 'STANDARD_LWC' | 'MONOREPO' | 'MONOREPO_LWC' | 'SFDX' | 'CORE_ALL' | 'CORE_PARTIAL' | 'UNKNOWN';

export const isLWC = (type: WorkspaceType): boolean => type === 'SFDX' || type === 'STANDARD_LWC' || type === 'CORE_ALL' || type === 'CORE_PARTIAL';

export const getSfdxProjectFile = (root: string): string => path.join(root, SFDX_PROJECT);

/**
 * @param root
 * @returns WorkspaceType for singular root
 */
export const detectWorkspaceHelper = (root: string): WorkspaceType => {
    if (fs.existsSync(getSfdxProjectFile(root))) {
        return 'SFDX';
    }
    if (fs.existsSync(path.join(root, 'workspace-user.xml'))) {
        return 'CORE_ALL';
    }
    if (fs.existsSync(path.join(root, '..', 'workspace-user.xml'))) {
        return 'CORE_PARTIAL';
    }

    if (fs.existsSync(path.join(root, 'lwc.config.json'))) {
        return 'STANDARD_LWC';
    }

    const packageJson = path.join(root, 'package.json');
    if (fs.existsSync(packageJson)) {
        try {
            const packageInfo = JSON.parse(fs.readFileSync(packageJson, 'utf-8'));
            const dependencies = Object.keys(packageInfo.dependencies || {});
            const devDependencies = Object.keys(packageInfo.devDependencies || {});
            const allDependencies = [...dependencies, ...devDependencies];
            const hasLWCdependencies = allDependencies.some((key) => key.startsWith('@lwc/') || key === 'lwc');

            // any type of @lwc is a dependency
            if (hasLWCdependencies) {
                return 'STANDARD_LWC';
            }

            // has any type of lwc configuration
            if (packageInfo.lwc) {
                return 'STANDARD_LWC';
            }

            if (packageInfo.workspaces) {
                return 'MONOREPO';
            }

            if (fs.existsSync(path.join(root, 'lerna.json'))) {
                return 'MONOREPO';
            }

            return 'STANDARD';
        } catch (e) {
            // Log error and fallback to setting workspace type to Unknown
            console.error(`Error encountered while trying to detect workspace type ${e}`);
        }
    }

    console.error('unknown workspace type:', root);
    return 'UNKNOWN';
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
        if (type !== 'CORE_PARTIAL') {
            console.error('unknown workspace type');
            return 'UNKNOWN';
        }
    }
    return 'CORE_PARTIAL';
};
