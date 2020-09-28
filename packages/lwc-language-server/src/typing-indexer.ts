import * as glob from 'fast-glob';
import normalize from 'normalize-path';
import * as path from 'path';
import * as fsExtra from 'fs-extra';
import Typing from './typing';
import BaseIndexer from './base-indexer';
import { detectWorkspaceHelper, WorkspaceType } from '@salesforce/lightning-lsp-common/lib/shared';

const basenameRegex = new RegExp(/(?<name>[\w-_]+)\.[^\/]+$/);

type BaseIndexerAttributes = {
    workspaceRoot: string;
};

export function pathBasename(filename: string): string {
    const parsedPath: string = path.parse(filename).base;
    return basenameRegex.exec(parsedPath).groups.name;
}

export default class TypingIndexer extends BaseIndexer {
    readonly typingsBaseDir: string;
    readonly projectType: WorkspaceType;

    static diff(items: string[], compareItems: string[]): string[] {
        compareItems = compareItems.map(pathBasename);
        return items.filter(item => {
            const filename = pathBasename(item);
            return !compareItems.includes(filename);
        });
    }

    constructor(attributes: BaseIndexerAttributes) {
        super(attributes);
        this.projectType = detectWorkspaceHelper(attributes.workspaceRoot);

        switch (this.projectType) {
            case WorkspaceType.SFDX:
                this.typingsBaseDir = path.join(this.workspaceRoot, '.sfdx', 'typings', 'lwc');
                break;
            case WorkspaceType.CORE_PARTIAL:
                this.typingsBaseDir = path.join(this.workspaceRoot, '..', '.vscode', 'typings', 'lwc');
                break;
            case WorkspaceType.CORE_ALL:
                this.typingsBaseDir = path.join(this.workspaceRoot, '.vscode', 'typings', 'lwc');
                break;
        }
    }

    init(): void {
        if (this.projectType === WorkspaceType.SFDX) {
            this.createNewMetaTypings();
            this.deleteStaleMetaTypings();
            this.saveCustomLabelTypings();
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
        staleTypings.forEach((filename: string) => fsExtra.removeSync(filename));
    }

    async saveCustomLabelTypings(): Promise<void> {
        fsExtra.ensureDirSync(this.typingsBaseDir);
        const typings = this.customLabelFiles.map(filename => {
            const data = fsExtra.readFileSync(filename);
            return Typing.declarationsFromCustomLabels(data);
        });
        const typingContent = await Promise.all(typings);
        const fileContent = typingContent.join('\n');

        fsExtra.writeFileSync(this.customLabelTypings, fileContent);
    }

    get metaFiles(): string[] {
        const globPath = normalize(
            `${this.workspaceRoot}/${this.sfdxPackageDirsPattern}/**/+(staticresources|contentassets|messageChannels)/*.+(resource|asset|messageChannel)-meta.xml`,
        );
        return glob.sync(globPath).map(file => path.resolve(file));
    }

    get metaTypings(): string[] {
        const globPath = normalize(`${this.typingsBaseDir}/*.+(messageChannel|resource|asset).d.ts`);
        return glob.sync(globPath).map(file => path.resolve(file));
    }

    get customLabelFiles(): string[] {
        const globPath = normalize(`${this.sfdxPackageDirsPattern}/**/labels/CustomLabels.labels-meta.xml`);
        const result = glob.sync(globPath, { cwd: normalize(this.workspaceRoot) }).map(file => path.join(this.workspaceRoot, file));
        return result;
    }

    get customLabelTypings(): string {
        return path.join(this.typingsBaseDir, 'customlabels.d.ts');
    }
}
