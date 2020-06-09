import * as glob from 'glob';
import * as path from 'path';
import * as fsExtra from 'fs-extra';
import Typing from './typing';
import { shared } from '@salesforce/lightning-lsp-common';

const { detectWorkspaceHelper, WorkspaceType } = shared;

export default class TypingIndexer {
    readonly workspaceRoot: string;
    readonly sfdxPackageDirsPattern: string;
    readonly packageDirectories: string[];
    readonly typingsBaseDir: string;

    static diff(items: string[], compareItems: string[]): string[] {
        compareItems = compareItems.map(pathBasename);
        return items.filter(item => {
            const filename = pathBasename(item);
            return !compareItems.includes(filename);
        });
    }

    constructor(attributes: { [key: string]: any }) {
        this.workspaceRoot = path.resolve(attributes.workspaceRoot);
        this.sfdxPackageDirsPattern = attributes.sfdxPackageDirsPattern;

        const projectType = detectWorkspaceHelper(attributes.workspaceRoot);

        switch (projectType) {
            case WorkspaceType.SFDX:
                this.typingsBaseDir = path.join(this.workspaceRoot, '.sfdx/typings/lwc');
                break;
            case WorkspaceType.CORE_PARTIAL:
                this.typingsBaseDir = path.join(this.workspaceRoot, '../.vscode/typings/lwc');
                break;
            case WorkspaceType.CORE_ALL:
                this.typingsBaseDir = path.join(this.workspaceRoot, '.vscode/typings/lwc');
                break;
        }
    }

    createNewMetaTypings(): void {
        fsExtra.ensureDirSync(this.typingsBaseDir);
        const newFiles = TypingIndexer.diff(this.metaFiles, this.metaTypings);
        newFiles.forEach(async (filename: string) => {
            const typing = Typing.fromMeta(filename);
            const filePath = path.join(this.typingsBaseDir, typing.fileName);
            fsExtra.writeFileSync(filePath, typing.declaration);
        });
    }

    deleteStaleMetaTypings(): void {
        const staleTypings = TypingIndexer.diff(this.metaTypings, this.metaFiles);
        staleTypings.forEach(async (filename: string) => {
            const filePath = path.join(this.workspaceRoot, filename);
            fsExtra.removeSync(filePath);
        });
    }

    async saveCustomLabelTypings(): Promise<void> {
        fsExtra.ensureDirSync(this.typingsBaseDir);
        const typings = this.customLabelFiles.map(filename => {
            const filePath = path.join(this.workspaceRoot, filename);
            const data = fsExtra.readFileSync(filePath);
            return Typing.declarationsFromCustomLabels(data);
        });
        const typingContent = await Promise.all(typings);
        const fileContent = typingContent.join('\n');

        fsExtra.writeFileSync(this.customLabelTypings, fileContent);
    }

    get metaFiles(): string[] {
        const globPath = path.join(
            this.sfdxPackageDirsPattern,
            '**/+(staticresources|contentassets|messageChannels)',
            '*.+(resource|asset|messageChannel)-meta.xml',
        );
        return glob.sync(globPath, { cwd: this.workspaceRoot });
    }

    get metaTypings(): string[] {
        const root = path.relative(this.workspaceRoot, this.typingsBaseDir);
        const globPath = path.join(root, '*.+(messageChannel|resource|asset).d.ts');
        return glob.sync(globPath, { cwd: this.workspaceRoot });
    }

    get customLabelFiles(): string[] {
        const globPath = path.join(this.sfdxPackageDirsPattern, '/**/labels/CustomLabels.labels-meta.xml');
        return glob.sync(globPath, { cwd: this.workspaceRoot });
    }

    get customLabelTypings(): string {
        return path.join(this.typingsBaseDir, 'customlabels.d.ts');
    }
}

function pathBasename(filename: string): string {
    const regex = /\/(?<name>[\w-_]+)\.[^\/]+$/;
    return regex.exec(filename).groups.name;
}
