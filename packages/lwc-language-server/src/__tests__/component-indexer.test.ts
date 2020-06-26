import ComponentIndexer from '../component-indexer';
import * as path from 'path';
import { shared } from '@salesforce/lightning-lsp-common';
import URI from 'vscode-uri';

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

                expect(componentIndexer.customComponents.sort()).toEqual(expectedComponents.sort());
                expect(componentIndexer.customComponents).not.toContain('force-app/main/default/lwc/import_relative/messages.js');
                expect(componentIndexer.customComponents).not.toContain('force-app/main/default/lwc/todo/store.js');
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
});
