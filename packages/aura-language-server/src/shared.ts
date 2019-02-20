// utility methods shared with the vscode extension
import * as fs from 'fs';
import * as path from 'path';

const SFDX_PROJECT: string = 'sfdx-project.json';

export enum WorkspaceType {
    /** standard workspace with a package.json but no lwc dependencies */
    STANDARD,
    /** standard workspace with a package.json and lwc dependencies */
    STANDARD_LWC,
    /** sfdx workspace */
    SFDX,
    /** workspace including all core projects */
    CORE_ALL,
    /** workspace including only one single core project (should not be used in java mode) */
    CORE_SINGLE_PROJECT,

    UNKNOWN,
}

export function isLWC(type: WorkspaceType): boolean {
    return type === WorkspaceType.SFDX || type === WorkspaceType.STANDARD_LWC || type === WorkspaceType.CORE_ALL || type === WorkspaceType.CORE_SINGLE_PROJECT;
}

export function getSfdxProjectFile(workspaceRoot: string) {
    return path.join(workspaceRoot, SFDX_PROJECT);
}

export function detectWorkspaceType(workspaceRoot: string): WorkspaceType {
    if (fs.existsSync(getSfdxProjectFile(workspaceRoot))) {
        return WorkspaceType.SFDX;
    }
    if (fs.existsSync(path.join(workspaceRoot, 'workspace-user.xml'))) {
        return WorkspaceType.CORE_ALL;
    }
    if (fs.existsSync(path.join(workspaceRoot, '..', 'workspace-user.xml'))) {
        return WorkspaceType.CORE_SINGLE_PROJECT;
    }

    const packageJson = path.join(workspaceRoot, 'package.json');
    if (fs.existsSync(packageJson)) {
        try {
            // Check if package.json contains lwc-engine
            const packageInfo = JSON.parse(fs.readFileSync(packageJson, 'utf-8'));
            const dependencies = Object.keys(packageInfo.dependencies || {});
            if (dependencies.includes('lwc-engine')) {
                return WorkspaceType.STANDARD_LWC;
            }
            const devDependencies = Object.keys(packageInfo.devDependencies || {});
            if (devDependencies.includes('lwc-engine')) {
                return WorkspaceType.STANDARD_LWC;
            }
            return WorkspaceType.STANDARD;
        } catch (e) {
            // Log error and fallback to setting workspace type to Unknown
            console.error(`Error encountered while trying to detect workspace type ${e}`);
        }
    }

    console.error('unknown workspace type:', workspaceRoot);
    return WorkspaceType.UNKNOWN;
}