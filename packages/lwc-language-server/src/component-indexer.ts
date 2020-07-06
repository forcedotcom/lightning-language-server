import Tag from './tag';
import * as path from 'path';
import { shared } from '@salesforce/lightning-lsp-common';
import { Entry, sync } from 'fast-glob';
import * as fsExtra from 'fs-extra';
import { join } from 'path';
import { snakeCase } from 'change-case';
import camelcase from 'camelcase';
import BaseIndexer from './base-indexer';
import URI from 'vscode-uri';

const { detectWorkspaceHelper, WorkspaceType } = shared;
const CUSTOM_COMPONENT_INDEX_FILE = '.sfdx/indexes/lwc/custom-components.json';
const componentPrefixRegex = new RegExp(/^(?<type>c|lightning|interop){0,1}(?<delimiter>:|-{0,1})(?<name>[\w\-]+)$/);

type ComponentIndexerAttributes = {
    workspaceRoot: string;
};

export enum DelimiterType {
    Aura = ':',
    LWC = '-',
}

export function tagEqualsFile(tag: Tag, entry: Entry): boolean {
    return tag.file === entry.path && tag.updatedAt?.getTime() === entry.stats?.mtime.getTime();
}

export function unIndexedFiles(entries: Entry[], tags: Tag[]) {
    return entries.filter(entry => !tags.some(tag => tagEqualsFile(tag, entry)));
}

export default class ComponentIndexer extends BaseIndexer {
    readonly workspaceType: number;
    readonly tags: Map<string, Tag> = new Map();

    constructor(attributes: ComponentIndexerAttributes) {
        super(attributes);
        this.workspaceType = detectWorkspaceHelper(attributes.workspaceRoot);
    }

    get componentEntries(): Entry[] {
        let files: Entry[] = [];
        switch (this.workspaceType) {
            case WorkspaceType.SFDX:
                files = sync(path.join(this.workspaceRoot, this.sfdxPackageDirsPattern, '**/*/lwc/**/*.js'), {
                    stats: true,
                });
                return files.filter((item: Entry): boolean => {
                    const data = path.parse(item.path);
                    return data.dir.endsWith(data.name);
                });
            default:
                // For CORE_ALL and CORE_PARTIAL
                files = sync(path.join(this.workspaceRoot, '**/*/modules/**/*.js'), {
                    stats: true,
                });
                return files.filter((item: Entry): boolean => {
                    const data = path.parse(item.path);
                    return data.dir.endsWith(data.name);
                });
        }
    }

    get customData(): Tag[] {
        return Array.from(this.tags.values());
    }

    findTagByName(query: string): Tag | null {
        const matches = componentPrefixRegex.exec(query);
        const { delimiter, name } = matches?.groups;
        if (delimiter === DelimiterType.Aura && !/[-_]+/.test(name)) {
            return this.tags.get(name) || this.tags.get(snakeCase(name)) || null;
        } else if (delimiter === DelimiterType.LWC) {
            return this.tags.get(name) || this.tags.get(camelcase(name)) || null;
        }
        return this.tags.get(query) || null;
    }

    findTagByURI(uri: string): Tag | null {
        const uriText = uri.replace('.html', '.js');
        const query = URI.file(path.resolve(uriText)).fsPath;
        return Array.from(this.tags.values()).find(tag => tag.uri === query) || null;
    }

    loadTagsFromIndex() {
        try {
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
        } catch (err) {
            console.error(err);
        }
    }

    persistCustomComponents() {
        const indexPath = join(this.workspaceRoot, CUSTOM_COMPONENT_INDEX_FILE);
        const indexJsonString = JSON.stringify(this.customData);
        fsExtra.writeFileSync(indexPath, indexJsonString);
    }

    get unIndexedFiles(): Entry[] {
        return unIndexedFiles(this.componentEntries, this.customData);
    }

    get staleTags(): Tag[] {
        return this.customData.filter(tag => {
            return !this.componentEntries.some(entry => entry.path === tag.file);
        });
    }

    async init() {
        this.loadTagsFromIndex();
        const promises = this.unIndexedFiles.map(entry => Tag.fromFile(entry.path, entry.stats.mtime));
        const tags = await Promise.all(promises);
        tags.filter(Boolean).forEach(tag => {
            this.tags.set(tag.name, tag);
        });

        this.staleTags.forEach(tag => this.tags.delete(tag.name));
    }

    async reindex() {
        const promises = this.componentEntries.map(entry => Tag.fromFile(entry.path));
        const tags = await Promise.all(promises);
        this.tags.clear();
        tags.forEach(tag => {
            this.tags.set(tag.name, tag);
        });
    }
}
