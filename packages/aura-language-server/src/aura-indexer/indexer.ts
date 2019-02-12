import { WorkspaceContext, shared, Indexer, TagInfo, utils } from 'lightning-lsp-common';
import { LWCIndexer } from 'lwc-language-server/lib/indexer';
import { Location } from 'vscode-languageserver';
import * as auraUtils from '../aura-utils';
import * as fs from 'fs-extra';
import { AttributeInfo, componentUtil } from 'lightning-lsp-common';
import { parse, Node } from '../html-language-service/parser/htmlParser';
import LineColumnFinder from 'line-column';
import URI from 'vscode-uri';
import changeCase from 'change-case';
import EventsEmitter from 'events';

const { WorkspaceType } = shared;

export default class AuraIndexer implements Indexer {
    public readonly tagEvents = new EventsEmitter();

    private context: WorkspaceContext;
    private indexingTasks: Promise<void>;

    private lwcIndexer: LWCIndexer | null;
    private listeners: Map<string, any> = new Map();

    private AURA_TAGS: Map<string, TagInfo> = new Map();
    private AURA_EVENTS: Map<string, TagInfo> = new Map();
    private AURA_NAMESPACES: Set<string> = new Set();

    constructor(context: WorkspaceContext) {
        this.context = context;
        this.context.addIndexingProvider({ name: 'aura', indexer: this });
    }

    public async configureAndIndex() {
        const indexingTasks: Array<Promise<void>> = [];

        this.lwcIndexer = new LWCIndexer(this.context);
        this.context.addIndexingProvider({ name: 'lwc', indexer: this.lwcIndexer });

        this.addListener('delete', (tag: string) => {
            const transformedName = this.transformLwcTagName(tag);
            const auraName = [transformedName.namespace, transformedName.name].join(':');

            this.deleteCustomTag(auraName);
        });
        this.addListener('set', (tagInfo: TagInfo) => {
            const tag = tagInfo.name;
            if (!tag.startsWith('lightning')) {
                const interopTagInfo = this.transformLwcTagToAura(tag, tagInfo);
                this.setCustomTag(interopTagInfo);
            }
        });

        indexingTasks.push(this.lwcIndexer.configureAndIndex());
        indexingTasks.push(this.loadStandardComponents());
        indexingTasks.push(this.loadSystemTags());
        indexingTasks.push(this.indexCustomComponents());

        this.indexingTasks = Promise.all(indexingTasks).then(() => undefined);
        return this.indexingTasks;
    }

    public async waitForIndexing() {
        return this.indexingTasks;
    }

    public resetIndex() {
        this.tagEvents.emit('clear');

        if (this.lwcIndexer) {
            this.lwcIndexer.tagEvents.removeAllListeners();
            this.lwcIndexer.resetIndex();
        }
        this.AURA_TAGS.clear();
        this.AURA_EVENTS.clear();
    }

    public getAuraTags(): Map<string, TagInfo> {
        return this.AURA_TAGS;
    }

    public getAuraNamespaces(): string[] {
        return [...this.AURA_NAMESPACES];
    }

    public getAuraByTag(tag: string): TagInfo {
        return this.getAuraTags().get(tag);
    }

    public clearTagsforDirectory(directory: string, sfdxProject: boolean) {
        const name = componentUtil.componentFromDirectory(directory, sfdxProject);
        this.deleteCustomTag(name);
    }

    public async indexFile(file: string, sfdxProject: boolean): Promise<TagInfo | undefined> {
        // console.log(file);

        if (!fs.existsSync(file)) {
            this.clearTagsforFile(file, sfdxProject);
            return;
        }
        const markup = await fs.readFile(file, 'utf-8');
        const result = parse(markup);
        const tags = [];
        for (const root of result.roots) {
            tags.push(...this.searchAura(root));
        }

        const tagInfo = this.getTagInfo(file, sfdxProject, markup, result.roots[0]);
        if (!tagInfo) {
            this.clearTagsforFile(file, sfdxProject);
            return;
        }
        const attributeInfos = tags
            .filter(tag => tag.tag.startsWith('aura:attribute'))
            .map(node => {
                const attributes = node.attributes || {};
                const documentation = this.trimQuotes(attributes.description);
                const jsName = this.trimQuotes(attributes.name);
                const type = this.trimQuotes(attributes.type);
                const startColumn = new LineColumnFinder(markup).fromIndex(node.start);
                const endColumn = new LineColumnFinder(markup).fromIndex(node.end - 1);

                const location: Location = {
                    uri: URI.file(file).toString(),
                    range: {
                        start: {
                            line: startColumn.line,
                            character: startColumn.col,
                        },
                        end: {
                            line: endColumn.line,
                            character: endColumn.col,
                        },
                    },
                };

                return new AttributeInfo(jsName, documentation, type, location);
            });
        tagInfo.attributes = attributeInfos;
        this.setCustomTag(tagInfo);
        return tagInfo;
    }

    private addListener(event: string, listener: any) {
        this.listeners.set(event, listener);
        this.lwcIndexer.tagEvents.on(event, listener);
    }

    private removeListeners() {
        for (const [event, listener] of this.listeners.entries()) {
            this.lwcIndexer.tagEvents.removeListener(event, listener);
        }
    }

    private async indexCustomComponents() {
        const startTime = process.hrtime();
        const markupfiles = await this.context.findAllAuraMarkup();
       
        for (const file of markupfiles) {
            try {
                await this.indexFile(file, this.context.type === WorkspaceType.SFDX);
            } catch (e) {
                console.log(`Error parsing markup from ${file}:`, e);
            }
        }
        console.info(`Indexed ${markupfiles.length} files in ${utils.elapsedMillis(startTime)} ms`);
    }

    private clearTagsforFile(file: string, sfdxProject: boolean) {
        const name = componentUtil.componentFromFile(file, sfdxProject);
        this.deleteCustomTag(name);
    }

    private deleteCustomTag(tag: string) {
        this.AURA_TAGS.delete(tag);
        this.AURA_EVENTS.delete(tag);

        this.tagEvents.emit('delete', tag);
    }
    private setAuraNamespaceTag(namespace: string) {
        if (!this.AURA_NAMESPACES.has(namespace)) {
            this.AURA_NAMESPACES.add(namespace);
            this.tagEvents.emit('set-namespace', namespace);
        }
    }

    private setCustomEventTag(info: TagInfo) {
        this.setAuraNamespaceTag(info.namespace);
        this.AURA_EVENTS.set(info.name, info);
        this.tagEvents.emit('set', info);
    }

    private setCustomTag(info: TagInfo) {
        this.setAuraNamespaceTag(info.namespace);
        this.AURA_TAGS.set(info.name, info);
        this.tagEvents.emit('set', info);
    }

    private async loadSystemTags(): Promise<void> {
        const data = await fs.readFile(auraUtils.getAuraSystemResourcePath(), 'utf-8');
        const auraSystem = JSON.parse(data);
        for (const tag in auraSystem) {
            // TODO need to account for LWC tags here
            if (auraSystem.hasOwnProperty(tag) && typeof tag === 'string') {
                const tagObj = auraSystem[tag];
                const info = new TagInfo(null, false, []);
                if (tagObj.attributes) {
                    for (const a of tagObj.attributes) {
                        // TODO - could we use more in depth doc from component library here?
                        info.attributes.push(new AttributeInfo(a.name, a.description, a.type, undefined, 'Aura Attribute'));
                    }
                }
                info.documentation = tagObj.description;
                info.name = tag;
                info.namespace = tagObj.namespace;

                this.setCustomTag(info);
            }
        }
    }

    private async loadStandardComponents(): Promise<void> {
        const data = await fs.readFile(auraUtils.getAuraStandardResourcePath(), 'utf-8');
        const auraStandard = JSON.parse(data);
        for (const tag in auraStandard) {
            // TODO need to account for LWC tags here
            if (auraStandard.hasOwnProperty(tag) && typeof tag === 'string') {
                const tagObj = auraStandard[tag];
                const info = new TagInfo(null, false, []);
                if (tagObj.attributes) {
                    for (const a of tagObj.attributes) {
                        // TODO - could we use more in depth doc from component library here?
                        info.attributes.push(new AttributeInfo(a.name, a.description, a.type, undefined, 'Aura Attribute'));
                    }
                }
                info.documentation = tagObj.description;
                info.name = tag;
                info.namespace = tagObj.namespace;

                // Update our in memory maps
                // TODO should we move interfaces/apps/etc to a separate map also?
                if (tagObj.type === 'event') {
                    this.setCustomEventTag(info);
                } else {
                    this.setCustomTag(info);
                }
            }
        }
    }

    private searchAura(node: Node): Node[] {
        const results = [];
        if (node.tag.indexOf(':') !== -1) {
            results.push(node);
        }
        for (const child of node.children) {
            results.push(...this.searchAura(child));
        }
        return results;
    }

    private trimQuotes(str: string) {
        if (!str) {
            return '';
        }
        return str.replace(/"([^"]+(?="))"/g, '$1');
    }

    private getTagInfo(file: string, sfdxProject: boolean, contents: string, node: Node): TagInfo {
        if (!node) {
            return;
        }
        const attributes = node.attributes || {};
        const documentation = this.trimQuotes(attributes.description);

        const startColumn = new LineColumnFinder(contents).fromIndex(node.start);
        const endColumn = new LineColumnFinder(contents).fromIndex(node.end - 1);

        const location: Location = {
            uri: URI.file(file).toString(),
            range: {
                start: {
                    line: startColumn.line,
                    character: startColumn.col,
                },
                end: {
                    line: endColumn.line,
                    character: endColumn.col,
                },
            },
        };
        const name = componentUtil.componentFromFile(file, sfdxProject);
        const info = new TagInfo(file, false, [], location, documentation, name, 'c');
        return info;
    }

    private isAuraNamespace(namespace: string): boolean {
        return this.AURA_NAMESPACES.has(namespace);
    }

    private transformLwcTagName(tag: string) {
        const namespace = tag.split('-')[0];
        const name = tag
            .split('-')
            .slice(1)
            .join('-');
        return {
            namespace,
            name: changeCase.camelCase(name),
        };
    }
    private transformLwcTagToAura(tag: string, tagInfo: any): TagInfo {
        const interopTagInfo = JSON.parse(JSON.stringify(tagInfo));

        const transformedName = this.transformLwcTagName(tag);
        interopTagInfo.name = [transformedName.namespace, transformedName.name].join(':');

        const attrs: AttributeInfo[] = [];
        for (const attribute of interopTagInfo.attributes) {
            const attrname = changeCase.camelCase(attribute.jsName || attribute.name);
            attrs.push(new AttributeInfo(attrname, attribute.documentation, attribute.type, attribute.Location, ''));
        }

        const info = new TagInfo(
            interopTagInfo.file,
            true,
            attrs,
            interopTagInfo.location,
            interopTagInfo.documentation,
            interopTagInfo.name,
            transformedName.namespace,
        );
        return info;
    }
}
