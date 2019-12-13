import { WorkspaceContext, componentUtil } from 'lightning-lsp-common';
import { LWCIndexer } from '../indexer';
import * as config from '../config';
import * as path from 'path';
import { FORCE_APP_ROOT, UTILS_ROOT } from './test-utils';
import * as fs from 'fs-extra';

beforeEach(() => {
    const jsconfigPathForceApp = FORCE_APP_ROOT + '/lwc/jsconfig.json';
    const jsconfigPathUtilsOrig = UTILS_ROOT + '/lwc/jsconfig-orig.json';
    const jsconfigPathUtils = UTILS_ROOT + '/lwc/jsconfig.json';
    const sfdxTypingsPath = 'test-workspaces/sfdx-workspace/.sfdx/typings/lwc';
    const forceignorePath = 'test-workspaces/sfdx-workspace/.forceignore';

    // make sure no generated files are there from previous runs
    fs.removeSync(jsconfigPathForceApp);
    fs.copySync(jsconfigPathUtilsOrig, jsconfigPathUtils);
    fs.removeSync(forceignorePath);
    fs.removeSync(sfdxTypingsPath);
});

it('lifecycle', async () => {
    const context = new WorkspaceContext('test-workspaces/sfdx-workspace');
    await context.configureProject();
    const lwcIndexer = new LWCIndexer(context);
    context.addIndexingProvider({ name: 'lwc', indexer: lwcIndexer });
    await lwcIndexer.configureAndIndex();

    // verify jsconfig.json after indexing
    const jsconfigPathForceApp = FORCE_APP_ROOT + '/lwc/jsconfig.json';
    const data = fs.readFileSync(jsconfigPathForceApp, 'utf8');

    let jsconfigForceApp: config.IJsconfig = JSON.parse(data);
    expect(jsconfigForceApp.compilerOptions.baseUrl).toBe('.');
    expect(jsconfigForceApp.compilerOptions.paths).toMatchObject({
        'c/hello_world': ['hello_world/hello_world.js'],
        'c/todo_utils': ['../../../../utils/meta/lwc/todo_utils/todo_utils.js'],
    });
    const jsconfigPathUtils = UTILS_ROOT + '/lwc/jsconfig.json';
    const jsconfigPathUtilsData = fs.readFileSync(jsconfigPathUtils, 'utf8');

    const jsconfigUtils = JSON.parse(jsconfigPathUtilsData);
    expect(jsconfigUtils.compilerOptions.baseUrl).toBe('.');
    expect(jsconfigUtils.compilerOptions.paths).toMatchObject({
        'c/hello_world': ['../../../force-app/main/default/lwc/hello_world/hello_world.js'],
        'c/todo_utils': ['todo_utils/todo_utils.js'],
    });

    // onSetCustomComponent (create):
    const newCompTag = 'c/new_comp';
    const newCompPath = UTILS_ROOT + path.join('meta', 'lwc', 'new_comp', 'new_comp.js');
    expect(jsconfigForceApp.compilerOptions.paths[newCompTag]).toBeUndefined();
    await config.onSetCustomComponent(context, newCompPath);
    jsconfigForceApp = JSON.parse(fs.readFileSync(jsconfigPathForceApp, 'utf8'));
    expect(jsconfigForceApp.compilerOptions.paths[newCompTag]).toEqual(['../../../../utils/metameta/lwc/new_comp/new_comp.js']);

    // onSetCustomComponent (update):
    const existingCompTag = 'c/new_comp';
    const existingCompPath = UTILS_ROOT + path.join('meta', 'lwc', 'new_comp', 'new_comp.js');
    expect(jsconfigForceApp.compilerOptions.paths[existingCompTag]).toBeDefined();
    await config.onSetCustomComponent(context, existingCompPath);
    jsconfigForceApp = JSON.parse(fs.readFileSync(jsconfigPathForceApp, 'utf8'));
    expect(jsconfigForceApp.compilerOptions.paths[existingCompTag]).toEqual(['../../../../utils/metameta/lwc/new_comp/new_comp.js']);

    // onDeleteCustomComponent:
    const moduleTag = componentUtil.moduleFromFile(newCompPath, true);
    await config.onDeletedCustomComponent(moduleTag, context);
    jsconfigForceApp = JSON.parse(fs.readFileSync(jsconfigPathForceApp, 'utf8'));
    expect(jsconfigForceApp.compilerOptions.paths[newCompTag]).toBeUndefined();
    // no error deleting non-existing:

    config.onDeletedCustomComponent(moduleTag, context);
});
