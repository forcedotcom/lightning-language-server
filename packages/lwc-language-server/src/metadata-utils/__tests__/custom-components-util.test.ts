import { join } from 'path';
import * as fs from 'fs-extra';
import URI from 'vscode-uri';
import { LWCIndexer } from '../../indexer';
import { FORCE_APP_ROOT, UTILS_ROOT } from '../../__tests__/test-utils';
import { WorkspaceContext } from 'lightning-lsp-common';
import { addCustomTagFromFile, getLwcByTag } from '../custom-components-util';

it('addCustomTagFromFile(): adds custom tag attributes and documentation', async () => {
    const context = new WorkspaceContext('test-workspaces/sfdx-workspace');
    // custom tag is not indexed initially
    let tagInfo = getLwcByTag('c-todo_item');
    expect(tagInfo).toBeUndefined();

    // index todo_item.js ==> custom tag and attributes are added to the index
    await addCustomTagFromFile(context, join('test-workspaces', 'sfdx-workspace', 'force-app', 'main', 'default', 'lwc', 'todo_item', 'todo_item.js'), true);
    tagInfo = getLwcByTag('c-todo_item');
    expect(tagInfo).toMatchObject({ attributes: [{ name: 'todo' }, { name: 'same-line' }, { name: 'next-line' }], documentation: 'TodoItem doc' });
    const location = tagInfo.location;
    expect(URI.parse(location.uri).fsPath).toExist();
    expect(location.uri).toEndWith('/test-workspaces/sfdx-workspace/force-app/main/default/lwc/todo_item/todo_item.js');
    expect(location.range.start.line).toBe(6);
});

it('indexSfdx', async () => {
    const context = new WorkspaceContext('test-workspaces/sfdx-workspace');
    await context.configureProject();
    const lwcIndexer = new LWCIndexer(context);
    await lwcIndexer.configureAndIndex();
    context.addIndexingProvider({ name: 'lwc', indexer: lwcIndexer });

    // check attributes
    expect(getLwcByTag('c-todo_item').attributes).toMatchObject([
        {
            detail: 'LWC custom attribute',
            documentation: 'todo jsdoc',
            name: 'todo',
            location: {
                range: { start: { line: 14, character: 4 }, end: { line: 17, character: 5 } },
            },
        },
        { name: 'same-line' },
        { name: 'next-line' },
    ]);
    expect(getLwcByTag('c-todo_util').attributes).toMatchObject([
        {
            detail: 'LWC custom attribute',
            name: 'info',
            location: {
                range: { start: { line: 3, character: 4 }, end: { line: 4, character: 9 } },
            },
        },
        { detail: 'LWC custom attribute', name: 'icon-name' },
        { detail: 'LWC custom attribute', name: 'upper-c-a-s-e' },
    ]);
    // check standard components
    expect(getLwcByTag('lightning-button')).not.toBeUndefined();
    expect(getLwcByTag('lightning-button').documentation).toBe('Represents a button element.');
    expect(getLwcByTag('lightning-button').attributes[0]).toMatchObject({
        detail: 'LWC standard attribute',
        documentation: 'Specifies a shortcut key to activate or focus an element.',
        name: 'accesskey',
    });
    // check tag Location
    const uri = getLwcByTag('c-todo_item').location.uri;
    expect(URI.parse(uri).fsPath).toExist();
    expect(uri).toEndWith('/test-workspaces/sfdx-workspace/force-app/main/default/lwc/todo_item/todo_item.js');
    // check attribute location
    expect(getLwcByTag('c-todo_item').attributes[0].location.uri).toBe(uri);
    // check properties/methods
    expect(getLwcByTag('c-todo_util').properties).toMatchObject([
        { name: 'info' },
        { name: 'iconName' },
        { name: 'upperCASE' },
        { name: 'trackProperty' },
        { name: 'privateProperty' },
    ]);
    expect(getLwcByTag('c-todo_util').methods).toMatchObject([{ name: 'privateMethod' }]);
    // indexing of components without .html file
    expect(getLwcByTag('c-todo_utils')).not.toBeUndefined();

    // verify modifycations in jsconfig.json when indexing
    const jsconfigPathForceApp = FORCE_APP_ROOT + '/lwc/jsconfig.json';
    const jsconfigForceApp = JSON.parse(fs.readFileSync(jsconfigPathForceApp, 'utf8'));
    expect(jsconfigForceApp.compilerOptions.baseUrl).toBe('.');
    expect(jsconfigForceApp.compilerOptions.paths).toMatchObject({
        'c/hello_world': ['hello_world/hello_world.js'],
        'c/todo_utils': ['../../../../utils/meta/lwc/todo_utils/todo_utils.js'],
    });
    const jsconfigPathUtils = UTILS_ROOT + '/lwc/jsconfig.json';
    const jsconfigUtils = JSON.parse(fs.readFileSync(jsconfigPathUtils, 'utf8'));
    expect(jsconfigUtils.compilerOptions.baseUrl).toBe('.');
    expect(jsconfigUtils.compilerOptions.paths).toMatchObject({
        'c/hello_world': ['../../../force-app/main/default/lwc/hello_world/hello_world.js'],
        'c/todo_utils': ['todo_utils/todo_utils.js'],
    });
});

it('indexCore', async () => {
    // test indexing of core-like workspace
    const context = new WorkspaceContext('test-workspaces/core-like-workspace/app/main/core');
    await context.configureProject();
    const lwcIndexer = new LWCIndexer(context);
    await lwcIndexer.configureAndIndex();
    context.addIndexingProvider({ name: 'lwc', indexer: lwcIndexer });

    // check attributes
    expect(getLwcByTag('one-app-nav-bar').attributes).toEqual([]);
    expect(getLwcByTag('force-input-phone').attributes).toMatchObject([{ detail: 'LWC custom attribute', name: 'value' }]);
    // check standard components
    expect(getLwcByTag('lightning-button')).not.toBeUndefined();
    // check tag Location
    const uri = getLwcByTag('one-app-nav-bar').location.uri;
    expect(URI.parse(uri).fsPath).toExist();
    expect(uri).toEndWith('/test-workspaces/core-like-workspace/app/main/core/ui-global-components/modules/one/app-nav-bar/app-nav-bar.js');
    // check attr Location
    const attrUri = getLwcByTag('force-input-phone').location.uri;
    expect(URI.parse(attrUri).fsPath).toExist();
    expect(attrUri).toEndWith('/test-workspaces/core-like-workspace/app/main/core/ui-force-components/modules/force/input-phone/input-phone.js');
});

it('indexStandard', async () => {
    const context = new WorkspaceContext('test-workspaces/standard-workspace');
    await context.configureProject();
    const lwcIndexer = new LWCIndexer(context);
    await lwcIndexer.resetIndex();
    await lwcIndexer.configureAndIndex();
    context.addIndexingProvider({ name: 'lwc', indexer: lwcIndexer });

    // check attributes
    expect(getLwcByTag('example-line').attributes).toMatchObject([
        { detail: 'LWC custom attribute', name: 'hover' },
        { detail: 'LWC custom attribute', name: 'text' },
    ]);
    expect(getLwcByTag('lightning-ito').attributes).toMatchObject([
        {
            detail: 'LWC custom attribute',
            documentation: undefined,
            name: 'attr',
            location: { range: { start: { line: 4, character: 4 }, end: { line: 4, character: 14 } } },
        },
    ]);
    // check standard components
    expect(getLwcByTag('lightning-button')).toBeUndefined();
    // check Location
    let uri = getLwcByTag('example-line').location.uri;
    expect(URI.parse(uri).fsPath).toExist();
    expect(uri).toEndWith('/test-workspaces/standard-workspace/src/modules/example/line/line.js');
    uri = getLwcByTag('lightning-ito').location.uri;
    expect(URI.parse(uri).fsPath).toExist();
    expect(uri).toEndWith('/test-workspaces/standard-workspace/src/modules/interop/ito/ito.js');
});
