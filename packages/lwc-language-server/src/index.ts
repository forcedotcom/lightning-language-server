import * as glob from 'glob';
import * as path from 'path';
import * as fsExtra from 'fs-extra';
import Typing from './typing';
import { shared } from '@salesforce/lightning-lsp-common';

const { detectWorkspaceHelper, WorkspaceType } = shared;

export default class Index {
    readonly workspaceRoot: string;
    readonly sfdxPackageDirsPattern: string;
    readonly projectType: number;

    private static readonly typingDirs: { [key: string]: string } = {
        asset: 'contentassets',
        resource: 'staticresources',
        messageChannel: 'messageChannels',
    };

    constructor(attributes: { [key: string]: string }) {
        this.workspaceRoot = path.resolve(attributes.workspaceRoot);
        this.sfdxPackageDirsPattern = attributes.sfdxPackageDirsPattern;
        this.projectType = detectWorkspaceHelper(attributes.workspaceRoot);
    }

    createNewMetaTypings(): void {
        Index.ensureTypingsDirs(this.workspaceRoot, this.projectType);

        Index.diff(this.metaFilePaths(), this.metaFileTypingPaths()).map(async (metaFilename: string) => {
            const typing = Typing.fromMeta(metaFilename);
            const filePath = path.join(this.workspaceRoot, this.typingDir(typing.type), typing.fileName);

            fsExtra.writeFileSync(filePath, typing.declaration());
        });
    }

    deleteStaleMetaTypings(): void {
        Index.diff(this.metaFileTypingPaths(), this.metaFilePaths()).map(async (typingFilename: string) => {
            const filePath = path.join(this.workspaceRoot, typingFilename);

            fsExtra.removeSync(filePath);
        });
    }

    metaFilePaths(): string[] {
        const globString = `${this.sfdxPackageDirsPattern}/**/+(staticresources|contentassets|messageChannels)/*.+(resource|asset|messageChannel)-meta.xml`;
        return glob.sync(globString, { cwd: this.workspaceRoot });
    }

    metaFileTypingPaths(): string[] {
        const globString = `${this.typingsBaseDir()}/+(messageChannels|staticresources|contentassets)/**/*.d.ts`;
        return glob.sync(globString, { cwd: this.workspaceRoot });
    }

    typingsBaseDir() {
        return Index.typingsBaseDir(this.projectType);
    }

    typingDir(metaType: string) {
        return path.join(this.typingsBaseDir(), Index.typingDirs[metaType]);
    }

    static typingsBaseDir(projectType: number) {
        switch (projectType) {
            case WorkspaceType.SFDX:
                return '.sfdx/typings/lwc';
            case WorkspaceType.CORE_PARTIAL:
                return '../.vscode/typings/lwc';
            case WorkspaceType.CORE_ALL:
                return '.vscode/typings/lwc';
        }
    }

    static ensureTypingsDirs(workspaceRoot: string, projectType: number) {
        Object.values(Index.typingDirs).forEach(typingDir => {
            const dir: string = path.join(workspaceRoot, this.typingsBaseDir(projectType), typingDir);
            fsExtra.ensureDirSync(dir);
        });
    }

    static diff(items: string[], compareItems: string[]): string[] {
        const regex = /\/(?<name>[\w-]+)\.[\w-]+\.\w+$/;
        const basenameFunction = (filename: string): string => {
            return filename.match(regex).groups.name;
        };
        compareItems = compareItems.map(basenameFunction);

        return items.filter(item => {
            const filename = basenameFunction(item);
            return !compareItems.includes(filename);
        });
    }
}
