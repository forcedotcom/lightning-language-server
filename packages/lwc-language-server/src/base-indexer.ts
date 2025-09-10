import * as path from 'path';
import * as fs from 'fs';
export default class BaseIndexer {
    readonly workspaceRoot: string;
    constructor(attributes: { workspaceRoot: string }) {
        this.workspaceRoot = path.resolve(attributes.workspaceRoot);
    }

    sfdxConfig(root: string): any {
        const filename: string = path.join(root, 'sfdx-project.json');
        const data: string = fs.readFileSync(filename).toString();

        return JSON.parse(data);
    }

    get sfdxPackageDirsPattern(): string {
        const dirs = this.sfdxConfig(this.workspaceRoot).packageDirectories;
        const paths: string[] = dirs.map((item: { path: string }): string => item.path);
        return paths.length === 1 ? paths[0] : `{${paths.join()}}`;
    }
}
