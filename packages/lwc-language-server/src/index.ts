import * as glob from 'glob';
import * as path from 'path';
import { shared } from '@salesforce/lightning-lsp-common';
const { detectWorkspaceHelper, WorkspaceType } = shared;

export default class Index {
    readonly workspaceRoot: string;
    readonly sfdxPackageDirsPattern: string;
    readonly projectType: number;

    constructor(attributes: { [key: string]: string }) {
        this.workspaceRoot = path.resolve(attributes.workspaceRoot);
        this.sfdxPackageDirsPattern = attributes.sfdxPackageDirsPattern;
        this.projectType = detectWorkspaceHelper(attributes.workspaceRoot);
    }

    static diff(items: string[], compareItems: string[]): string[] {
        const regex = /\/(?<name>[\w-]+)\.[\w-]+\.\w+$/;
        const basename = (filename: string) => filename.match(regex).groups.name;

        compareItems = compareItems.map(basename);

        return items.filter(item => {
            const filename = basename(item);
            return !compareItems.includes(filename);
        });
    }

    metaFilePaths(): string[] {
        const globString = `${this.sfdxPackageDirsPattern}/**/+(staticresources|contentassets|messageChannels)/*.+(resource|asset|messageChannel)-meta.xml`;
        return glob.sync(globString, { cwd: this.workspaceRoot });
    }

    metaFileTypingPaths(): string[] {
        const globString = `${this.typingsDir()}/+(messageChannels|staticresources|contentassets)/**/*.d.ts`;
        return glob.sync(globString, { cwd: this.workspaceRoot });
    }

    typingsDir() {
        switch (this.projectType) {
            case WorkspaceType.SFDX:
                return '.sfdx/typings/lwc';
            case WorkspaceType.CORE_PARTIAL:
                return '../.vscode/typings/lwc';
            case WorkspaceType.CORE_ALL:
                return '.vscode/typings/lwc';
        }
    }
}
