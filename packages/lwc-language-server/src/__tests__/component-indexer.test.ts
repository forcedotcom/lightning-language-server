import ComponentIndexer from '../component-indexer';
import * as path from 'path';
import { shared } from '@salesforce/lightning-lsp-common';

const { WorkspaceType } = shared;

const componentIndexer: ComponentIndexer = new ComponentIndexer({
    workspaceRoot: '../../test-workspaces/sfdx-workspace',
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
        describe('#componentDirectories', () => {
            it('returns a list of directories where components can live for sfdx projects', () => {
                const expectedPaths = ['force-app/main/default/lwc/', 'registered-empty-folder/meta/lwc/', 'utils/meta/lwc/'].map(item =>
                    path.join(componentIndexer.workspaceRoot, item),
                );
                expect(componentIndexer.componentDirectories).toEqual(expectedPaths);
                expect(componentIndexer.componentDirectories).not.toContain('non-registered-folder/meta/lwc/');
            });

            it('returns a list of directories where components can live for CORE_ALL projects', () => {
                const indexer: ComponentIndexer = new ComponentIndexer({
                    workspaceRoot: '../../test-workspaces/core-like-workspace',
                });

                const expectedPaths = ['app/main/core/ui-force-components/modules/', 'app/main/core/ui-global-components/modules/'].map(item =>
                    path.join(indexer.workspaceRoot, item),
                );
                expect(indexer.componentDirectories).toEqual(expectedPaths);
                expect(indexer.componentDirectories).not.toContain('non-registered-folder/meta/lwc/');
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

                expect(componentIndexer.customComponents).toEqual(expectedComponents);
                expect(componentIndexer.customComponents).not.toContain('force-app/main/default/lwc/import_relative/messages.js');
                expect(componentIndexer.customComponents).not.toContain('force-app/main/default/lwc/todo/store.js');
            });
        });

        describe('#generateIndex()', () => {
            it('creates Tag objects for all the component JS files', async () => {
                await componentIndexer.generateIndex();
                console.log(componentIndexer.tags);
                expect(componentIndexer.tags.size).toBe(8);
            });
        });
    });
});