import Tag from './tag';
import * as path from 'path';
import { shared } from '@salesforce/lightning-lsp-common';
import * as glob from 'glob';
import * as fsExtra from 'fs-extra';

const { detectWorkspaceHelper, WorkspaceType } = shared;

type ComponentIndexerAttributes = {
    workspaceRoot: string;
};

function sfdxConfig(root: string) {
    const filename: string = path.join(root, 'sfdx-project.json');
    const data: string = fsExtra.readFileSync(filename).toString();

    return JSON.parse(data);
}

export default class ComponentIndexer {
    readonly workspaceRoot: string;
    readonly workspaceType: number;
    readonly tags: Map<string, Tag> = new Map();

    constructor(attributes: ComponentIndexerAttributes) {
        this.workspaceRoot = path.resolve(attributes.workspaceRoot);
        this.workspaceType = detectWorkspaceHelper(attributes.workspaceRoot);
    }

    get componentDirectories(): string[] {
        switch (this.workspaceType) {
            case WorkspaceType.SFDX:
                const dirs = sfdxConfig(this.workspaceRoot).packageDirectories;
                const paths: string[] = dirs.map((item: { path: string }): string => item.path);
                const globBase: string = paths.length === 1 ? paths[0] : `{${paths.join()}}`;
                return glob.sync(path.join(this.workspaceRoot, globBase, '**/*/lwc/'));
            default:
                // For CORE_ALL and CORE_PARTIAL
                return glob.sync(path.join(this.workspaceRoot, '**/*/modules/'));
        }
    }

    get customComponents(): string[] {
        const dirs: string[] = this.componentDirectories;
        const globBase: string = dirs.length === 1 ? dirs[0] : `{${dirs.join()}}`;
        const paths = glob.sync(path.join(globBase, '/*/*.js'));
        return paths.filter((item: string): boolean => {
            const data = path.parse(item);
            return data.dir.endsWith(data.name);
        });
    }

    get customData(): any {
        return Array.from(this.tags.values());
    }

    async generateIndex() {
        const promises = this.customComponents.map(filepath => Tag.fromFile(filepath));
        const tags = await Promise.all(promises);
        tags.filter(Boolean).forEach(tag => {
            this.tags.set(tag.name, tag);
        });
    }
}
