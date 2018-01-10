// utility methods shared with the vscode extension

import * as fs from 'fs';
import * as path from 'path';

export enum WorkspaceType {
    /** standard workspace with a package.json but no lwc dependencies */
    STANDARD,
    /** standard workspace with a package.json and lwc dependencies */
    STANDARD_LWC,
    /** sfdx workspace */
    SFDX,
    /** workspace including all core projects */
    CORE_ALL,
    /** workspace including only one single core project */
    CORE_SINGLE_PROJECT,
    UNKNOWN,
}

export function isLWC(type: WorkspaceType): boolean {
    return type === WorkspaceType.SFDX || type === WorkspaceType.STANDARD_LWC || type === WorkspaceType.CORE_ALL || type === WorkspaceType.CORE_SINGLE_PROJECT;
}

export function detectWorkspaceType(workspaceRoot: string): WorkspaceType {
    if (fs.existsSync(path.join(workspaceRoot, 'sfdx-project.json'))) {
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
