import * as path from 'path';
import * as fs from 'fs';

// Utility function to resolve workspace root
export const getWorkspaceRoot = (workspaceRoot: string): string => {
    return path.resolve(workspaceRoot);
};

// Utility function to get SFDX configuration
export const getSfdxConfig = (root: string): any => {
    const filename: string = path.join(root, 'sfdx-project.json');
    const data: string = fs.readFileSync(filename).toString();
    return JSON.parse(data);
};

// Utility function to get SFDX package directories pattern
export const getSfdxPackageDirsPattern = (workspaceRoot: string): string => {
    const dirs = getSfdxConfig(workspaceRoot).packageDirectories;
    const paths: string[] = dirs.map((item: { path: string }): string => item.path);
    return paths.length === 1 ? paths[0] : `{${paths.join()}}`;
};
