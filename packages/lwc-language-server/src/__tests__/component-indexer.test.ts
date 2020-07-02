import ComponentIndexer, { unIndexedFiles } from '../component-indexer';
import Tag from '../tag';
import { Entry } from 'fast-glob';
import * as path from 'path';
import { shared } from '@salesforce/lightning-lsp-common';
import URI from 'vscode-uri';
import { Stats, Dirent } from 'fs';

const { WorkspaceType } = shared;
const workspaceRoot: string = '../../test-workspaces/sfdx-workspace';
const componentIndexer: ComponentIndexer = new ComponentIndexer({
    workspaceRoot,
});

describe('ComponentIndexer', () => {
    describe('new', () => {
        it('initializes with the root of a workspace', () => {
            const expectedPath: string = path.resolve('../../test-workspaces/sfdx-workspace');
            expect(componentIndexer.workspaceRoot).toEqual(expectedPath);
            expect(componentIndexer.workspaceType).toEqual(WorkspaceType.SFDX);
        });
    });

    describe('instance methods', () => {
        describe('#init', () => {
            it('adds a Tag to `tags` for each custom component', async () => {
                await componentIndexer.init();
                expect(componentIndexer.tags.size).toEqual(8);
                expect(componentIndexer.tags.get('c-hello_world'));
                componentIndexer.tags.clear();
            });
        });

        describe('#customComponents', () => {
            it('returns a list of files where the .js filename is the same as its parent directory name', () => {
                const expectedComponents: string[] = [
                    'force-app/main/default/lwc/hello_world/hello_world.js',
                    'force-app/main/default/lwc/import_relative/import_relative.js',
                    'force-app/main/default/lwc/index/index.js',
                    'force-app/main/default/lwc/lightning_datatable_example/lightning_datatable_example.js',
                    'force-app/main/default/lwc/lightning_tree_example/lightning_tree_example.js',
                    'force-app/main/default/lwc/todo_item/todo_item.js',
                    'force-app/main/default/lwc/todo/todo.js',
                    'force-app/main/default/lwc/utils/utils.js',
                    'utils/meta/lwc/todo_util/todo_util.js',
                    'utils/meta/lwc/todo_utils/todo_utils.js',
                ].map(item => path.join(componentIndexer.workspaceRoot, item));

                const paths = componentIndexer.componentEntries.map(entry => entry.path).sort();

                expect(paths).toEqual(expectedComponents.sort());
                expect(paths).not.toContain('force-app/main/default/lwc/import_relative/messages.js');
                expect(paths).not.toContain('force-app/main/default/lwc/todo/store.js');
            });
        });

        describe('findTagByName', () => {
            it('finds tag with an exact match', async () => {
                await componentIndexer.init();
                expect(componentIndexer.findTagByName('hello_world').name).toEqual('hello_world');
                expect(componentIndexer.findTagByName('foo')).toBeNull();
            });

            it('finds tag with lwc prefix', async () => {
                await componentIndexer.init();
                expect(componentIndexer.findTagByName('c-hello_world').name).toEqual('hello_world');
                expect(componentIndexer.findTagByName('c-hello-world')).toBeNull();
                expect(componentIndexer.findTagByName('c-helloWorld')).toBeNull();
                expect(componentIndexer.findTagByName('c-todo-foo')).toBeNull();
            });

            it('finds tag with aura prefix', async () => {
                await componentIndexer.init();
                expect(componentIndexer.findTagByName('c:hello_world')).toBeNull();
                expect(componentIndexer.findTagByName('c:hello-world')).toBeNull();
                expect(componentIndexer.findTagByName('c:helloWorld').name).toEqual('hello_world');
                expect(componentIndexer.findTagByName('c:todo').name).toEqual('todo');
                expect(componentIndexer.findTagByName('c:todoItem').name).toEqual('todo_item');
                expect(componentIndexer.findTagByName('c:todo-foo')).toBeNull();
            });
        });

        describe('#findTagByURI', () => {
            it('finds a Tag by matching the end of the URI', async () => {
                await componentIndexer.init();
                expect(componentIndexer.findTagByURI('force-app/main/default/lwc/hello_world/hello_world.js'));
                expect(componentIndexer.findTagByURI('lwc/hello_world/hello_world.js')).not.toBeNull();
                expect(componentIndexer.findTagByURI('hello_world.js')).not.toBeNull();
                expect(componentIndexer.findTagByURI('foo/bar/baz')).toBeNull();

                componentIndexer.tags.clear();
            });

            it('finds a Tag by its matching html file', async () => {
                await componentIndexer.init();
                expect(componentIndexer.findTagByURI('force-app/main/default/lwc/hello_world/hello_world.html')).not.toBeNull();
                expect(componentIndexer.findTagByURI('lwc/hello_world/hello_world.html')).not.toBeNull();
                expect(componentIndexer.findTagByURI('hello_world.html'));
                expect(componentIndexer.findTagByURI('foo/bar/baz')).toBeNull();

                componentIndexer.tags.clear();
            });
        });

        describe('#unIndexedFiles', () => {
            it('returns a list of files not yet indexed', () => {
                const unIndexed = componentIndexer.unIndexedFiles;
                expect(unIndexed.length).toBe(10);
            });
        });

        describe('#staleTags', () => {
            it('returns a list of tags that are stale and should be removed', () => {
                const stale = componentIndexer.staleTags;
                expect(stale.length).toBe(0);
            });
        });

        describe('#generateIndex()', () => {
            it('creates Tag objects for all the component JS files', async () => {
                await componentIndexer.init();
                expect(componentIndexer.tags.size).toBe(8);
            });
        });
    });

    describe('helper functions', () => {
        describe('unIndexedFiles', () => {
            it('it returns entries 0 entries when they match', () => {
                const stats = new Stats();
                stats.mtime = new Date('2020-01-01');
                const dirent = new Dirent();
                const tags: Tag[] = [new Tag({ file: '/foo', updatedAt: new Date('2020-01-01') })];
                const entries: Entry[] = [{ path: '/foo', stats, dirent, name: 'foo' }];

                expect(unIndexedFiles(entries, tags).length).toEqual(0);
            });

            it('it returns entries 1 entries when the entries date is different', () => {
                const stats = new Stats();
                stats.mtime = new Date('2020-02-01');
                const dirent = new Dirent();
                const tags: Tag[] = [new Tag({ file: '/foo', updatedAt: new Date('2020-01-01') })];
                const entries: Entry[] = [{ path: '/foo', stats, dirent, name: 'foo' }];

                expect(unIndexedFiles(entries, tags).length).toEqual(1);
            });

            it('it returns entries 1 entries when there is no matching tag', () => {
                const stats = new Stats();
                stats.mtime = new Date('2020-02-01');
                const dirent = new Dirent();
                const tags: Tag[] = [];
                const entries: Entry[] = [{ path: '/foo', stats, dirent, name: 'foo' }];

                expect(unIndexedFiles(entries, tags).length).toEqual(1);
            });
        });
    });
});
