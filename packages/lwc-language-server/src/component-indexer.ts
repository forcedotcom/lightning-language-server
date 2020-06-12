import Tag from './tag';
import * as path from 'path';
import { shared } from '@salesforce/lightning-lsp-common';
import * as glob from 'glob';
import * as fsExtra from 'fs-extra';
import { join } from 'path';
import decamelize from 'decamelize';

const { detectWorkspaceHelper, WorkspaceType } = shared;
const CUSTOM_COMPONENT_INDEX_FILE = '.sfdx/indexes/lwc/custom-components.json';

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

    get customComponents(): string[] {
        let files: string[] = [];
        switch (this.workspaceType) {
            case WorkspaceType.SFDX:
                const dirs = sfdxConfig(this.workspaceRoot).packageDirectories;
                const paths: string[] = dirs.map((item: { path: string }): string => item.path);
                const globBase: string = paths.length === 1 ? paths[0] : `{${paths.join()}}`;
                files = glob.sync(path.join(this.workspaceRoot, globBase, '**/*/lwc/**/*.js'));
                return files.filter((item: string): boolean => {
                    const data = path.parse(item);
                    return data.dir.endsWith(data.name);
                });
            default:
                // For CORE_ALL and CORE_PARTIAL
                files = glob.sync(path.join(this.workspaceRoot, '**/*/modules/**/*.js'));
                return files.filter((item: string): boolean => {
                    const data = path.parse(item);
                    return data.dir.endsWith(data.name);
                });
        }
    }

    get customData(): Tag[] {
        return Array.from(this.tags.values());
    }

    loadTagsFromIndex() {
        const indexPath: string = join(this.workspaceRoot, CUSTOM_COMPONENT_INDEX_FILE);
        const shouldInit: boolean = fsExtra.existsSync(indexPath);

        if (shouldInit) {
            const indexJsonString: string = fsExtra.readFileSync(indexPath, 'utf8');
            const index: object[] = JSON.parse(indexJsonString);
            index.forEach(data => {
                const info = new Tag(data);
                this.tags.set(info.name, info);
            });
        }
    }

    persistCustomComponents() {
        const indexPath = join(this.workspaceRoot, CUSTOM_COMPONENT_INDEX_FILE);
        const indexJsonString = JSON.stringify(this.customData);
        fsExtra.writeFileSync(indexPath, indexJsonString);
    }

    get unIndexedFiles(): string[] {
        return this.customComponents.filter(filepath => {
            return !this.customData.some(tag => tag.file === filepath);
        });
    }

    get staleTags(): Tag[] {
        return this.customData.filter(tag => {
            return !this.customComponents.some(filepath => filepath === tag.file);
        });
    }

    async init() {
        this.loadTagsFromIndex();
        const promises = this.unIndexedFiles.map(filepath => Tag.fromFile(filepath));
        const tags = await Promise.all(promises);
        tags.filter(Boolean).forEach(tag => {
            this.tags.set(tag.name, tag);
        });

        this.staleTags.forEach(tag => this.tags.delete(tag.name));
    }
}
