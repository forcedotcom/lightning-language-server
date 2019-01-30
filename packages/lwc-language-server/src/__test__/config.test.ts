import { utils, WorkspaceContext } from 'lightning-lsp-common';
import { LWCIndexer } from '../indexer';
import * as config from '../config';
import * as path from 'path';
import { FORCE_APP_ROOT, UTILS_ROOT } from './test-utils';

it('lifecycle', async () => {
    const context = new WorkspaceContext('test-workspaces/sfdx-workspace');
    context.configureProject();
    const lwcIndexer = new LWCIndexer(context);
    await lwcIndexer.configureAndIndex();
    context.addIndexingProvider({ name: 'lwc', indexer: lwcIndexer });

    // verify jsconfig.json after indexing
    const jsconfigPathForceApp = FORCE_APP_ROOT + '/lwc/jsconfig.json';
    let jsconfigForceApp: config.IJsconfig = JSON.parse(utils.readFileSync(jsconfigPathForceApp));
    expect(jsconfigForceApp.compilerOptions.baseUrl).toBe('.');
    expect(jsconfigForceApp.compilerOptions.paths).toMatchObject({
        'c/hello_world': ['hello_world/hello_world.js'],
        'c/todo_utils': ['../../../../utils/meta/lwc/todo_utils/todo_utils.js'],
    });
    const jsconfigPathUtils = UTILS_ROOT + '/lwc/jsconfig.json';
    const jsconfigUtils = JSON.parse(utils.readFileSync(jsconfigPathUtils));
    expect(jsconfigUtils.compilerOptions.baseUrl).toBe('.');
    expect(jsconfigUtils.compilerOptions.paths).toMatchObject({
        'c/hello_world': ['../../../force-app/main/default/lwc/hello_world/hello_world.js'],
        'c/todo_utils': ['todo_utils/todo_utils.js'],
    });

    // onCreateCustomComponent:
    const newCompTag = 'c/new_comp';
    const newCompPath = UTILS_ROOT + path.join('meta', 'lwc', 'new_comp', 'new_comp.js');
    expect(jsconfigForceApp.compilerOptions.paths[newCompTag]).toBeUndefined();
    config.onCreatedCustomComponent(context, newCompPath);
    jsconfigForceApp = JSON.parse(utils.readFileSync(jsconfigPathForceApp));
    expect(jsconfigForceApp.compilerOptions.paths[newCompTag]).toEqual(['../../../../utils/metameta/lwc/new_comp/new_comp.js']);

    // onDeleteCustomComponent:
    config.onDeletedCustomComponent(context, newCompPath);
    jsconfigForceApp = JSON.parse(utils.readFileSync(jsconfigPathForceApp));
    expect(jsconfigForceApp.compilerOptions.paths[newCompTag]).toBeUndefined();
    // no error deleting non-existing:
    config.onDeletedCustomComponent(context, newCompPath);
});
