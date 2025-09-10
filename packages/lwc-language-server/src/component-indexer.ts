import Tag from './tag';
import * as path from 'path';
import { shared, utils } from '@salesforce/lightning-lsp-common';
import { Entry, sync } from 'fast-glob';
import normalize from 'normalize-path';
import * as fs from 'fs';
import { snakeCase } from 'change-case';
import camelcase from 'camelcase';
import BaseIndexer from './base-indexer';

const { detectWorkspaceHelper, WorkspaceType } = shared;
const CUSTOM_COMPONENT_INDEX_PATH = path.join('.sfdx', 'indexes', 'lwc');
const CUSTOM_COMPONENT_INDEX_FILE = path.join(CUSTOM_COMPONENT_INDEX_PATH, 'custom-components.json');
const componentPrefixRegex = new RegExp(/^(?<type>c|lightning|interop){0,1}(?<delimiter>:|-{0,1})(?<name>[\w\-]+)$/);

type ComponentIndexerAttributes = {
    workspaceRoot: string;
};

type TsConfigPaths = {
    [key: string]: string[];
};

const AURA_DELIMITER = ':';
const LWC_DELIMITER = '-';

const tagEqualsFile = (tag: Tag, entry: Entry): boolean => {
    return tag.file === entry.path && tag.updatedAt?.getTime() === entry.stats?.mtime.getTime();
};

export const unIndexedFiles = (entries: Entry[], tags: Tag[]): Entry[] => {
    return entries.filter((entry) => !tags.some((tag) => tagEqualsFile(tag, entry)));
};

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
                const sfdxSource = normalize(`${this.workspaceRoot}/${this.sfdxPackageDirsPattern}/**/*/lwc/**/*.js`);
                files = sync(sfdxSource, {
                    stats: true,
                });
                return files.filter((item: Entry): boolean => {
                    const data = path.parse(item.path);
                    return data.dir.endsWith(data.name);
                });
            default:
                // For CORE_ALL and CORE_PARTIAL
                const defaultSource = normalize(`${this.workspaceRoot}/**/*/modules/**/*.js`);
                files = sync(defaultSource, {
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
        try {
            const matches = componentPrefixRegex.exec(query);
            const { delimiter, name } = matches?.groups;
            if (delimiter === AURA_DELIMITER && !/[-_]+/.test(name)) {
                return this.tags.get(name) || this.tags.get(snakeCase(name)) || null;
            } else if (delimiter === LWC_DELIMITER) {
                return this.tags.get(name) || this.tags.get(camelcase(name)) || null;
            }
            return this.tags.get(query) || null;
        } catch (err) {
            return null;
        }
    }

    findTagByURI(uri: string): Tag | null {
        const uriText = uri.replace('.html', '.js');
        return Array.from(this.tags.values()).find((tag) => tag.uri === uriText) || null;
    }

    loadTagsFromIndex(): void {
        try {
            const indexPath: string = path.join(this.workspaceRoot, CUSTOM_COMPONENT_INDEX_FILE);
            const shouldInit: boolean = fs.existsSync(indexPath);

            if (shouldInit) {
                const indexJsonString: string = fs.readFileSync(indexPath, 'utf8');
                const index: object[] = JSON.parse(indexJsonString);
                index.forEach((data) => {
                    const info = new Tag(data);
                    this.tags.set(info.name, info);
                });
            }
        } catch (err) {
            console.error(err);
        }
    }

    persistCustomComponents(): void {
        const indexPath = path.join(this.workspaceRoot, CUSTOM_COMPONENT_INDEX_FILE);
        fs.mkdirSync(path.join(this.workspaceRoot, CUSTOM_COMPONENT_INDEX_PATH), { recursive: true });
        const indexJsonString = JSON.stringify(this.customData);
        fs.writeFileSync(indexPath, indexJsonString);
    }

    insertSfdxTsConfigPath(filePaths: string[]): void {
        const sfdxTsConfigPath = normalize(`${this.workspaceRoot}/.sfdx/tsconfig.sfdx.json`);
        if (fs.existsSync(sfdxTsConfigPath)) {
            try {
                const sfdxTsConfig = utils.readJsonSync(sfdxTsConfigPath);
                for (const filePath of filePaths) {
                    const { dir, name: fileName } = path.parse(filePath);
                    const componentName = `c/${fileName}`;
                    const componentFilePath = path.join(dir, fileName);
                    const tsConfigFilePaths: string[] = (sfdxTsConfig.compilerOptions.paths[componentName] ??= []);
                    const hasExistingPath = tsConfigFilePaths.some((existingPath: string) => existingPath === componentFilePath);
                    if (!hasExistingPath) {
                        tsConfigFilePaths.push(componentFilePath);
                    }
                }
                utils.writeJsonSync(sfdxTsConfigPath, sfdxTsConfig);
            } catch (err) {
                console.error(err);
            }
        }
    }

    // This is a temporary solution to enable automated LWC module resolution for TypeScript modules.
    // It is intended to update the path mapping in the .sfdx/tsconfig.sfdx.json file.
    // TODO: Once the LWC custom module resolution plugin has been developed in the language server
    // this can be removed.
    updateSfdxTsConfigPath(): void {
        const sfdxTsConfigPath = normalize(`${this.workspaceRoot}/.sfdx/tsconfig.sfdx.json`);
        if (fs.existsSync(sfdxTsConfigPath)) {
            try {
                const sfdxTsConfig = utils.readJsonSync(sfdxTsConfigPath);
                // The assumption here is that sfdxTsConfig will not be modified by the user as
                // it is located in the .sfdx directory.
                sfdxTsConfig.compilerOptions.paths = this.tsConfigPathMapping;
                utils.writeJsonSync(sfdxTsConfigPath, sfdxTsConfig);
            } catch (err) {
                console.error(err);
            }
        }
    }

    get tsConfigPathMapping(): TsConfigPaths {
        const files: TsConfigPaths = {};
        if (this.workspaceType === WorkspaceType.SFDX) {
            const sfdxSource = normalize(`${this.workspaceRoot}/${this.sfdxPackageDirsPattern}/**/*/lwc/*/*.{js,ts}`);
            const filePaths = sync(sfdxSource, { stats: true });
            for (const filePath of filePaths) {
                const { dir, name: fileName } = path.parse(filePath.path);
                const folderName = path.basename(dir);
                if (folderName === fileName) {
                    const componentName = `c/${fileName}`;
                    const componentFilePath = path.join(dir, fileName);
                    const tsConfigFilePaths = (files[componentName] ??= []);
                    const hasExistingPath = tsConfigFilePaths.some((existingPath: string) => existingPath === componentFilePath);
                    if (!hasExistingPath) {
                        tsConfigFilePaths.push(componentFilePath);
                    }
                }
            }
        }
        return files;
    }

    get unIndexedFiles(): Entry[] {
        return unIndexedFiles(this.componentEntries, this.customData);
    }

    get staleTags(): Tag[] {
        const { componentEntries } = this;

        return this.customData.filter((tag) => {
            return !componentEntries.some((entry) => entry.path === tag.file);
        });
    }

    async init(): Promise<void> {
        this.loadTagsFromIndex();
        const promises = this.unIndexedFiles.map((entry) => Tag.fromFile(entry.path, entry.stats.mtime));
        const tags = await Promise.all(promises);
        tags.filter(Boolean).forEach((tag) => {
            this.tags.set(tag.name, tag);
        });

        this.staleTags.forEach((tag) => this.tags.delete(tag.name));
        this.persistCustomComponents();
    }

    async reindex(): Promise<void> {
        const promises = this.componentEntries.map((entry) => Tag.fromFile(entry.path));
        const tags = await Promise.all(promises);
        this.tags.clear();
        tags.forEach((tag) => {
            this.tags.set(tag.name, tag);
        });
    }
}
