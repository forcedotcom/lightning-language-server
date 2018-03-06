import { getLwcByTag, addCustomTagFromFile } from '../custom-components-util';
import { WorkspaceContext } from '../../context';
import URI from 'vscode-uri';
import { join } from 'path';

it('addCustomTagFromFile(): adds custom tag attributes and documentation', async () => {
    // custom tag is not indexed initially
    let tagInfo = getLwcByTag('c-todo_item');
    expect(tagInfo).toBeUndefined();

    // index todo_item.js ==> custom tag and attributes are added to the index
    await addCustomTagFromFile(
        join('test-workspaces', 'sfdx-workspace', 'force-app', 'main', 'default', 'lightningcomponents', 'todo_item', 'todo_item.js'),
        true,
    );
    tagInfo = getLwcByTag('c-todo_item');
    expect(tagInfo).toMatchObject({ attributes: [{ name: 'todo' }], documentation: 'TodoItem doc' });
    const location = tagInfo.location;
    expect(URI.parse(location.uri).fsPath).toExist();
    expect(location.uri).toEndWith('/test-workspaces/sfdx-workspace/force-app/main/default/lightningcomponents/todo_item/todo_item.js');
    expect(location.range.start.line).toBe(6);
});

it('indexSfdx', async () => {
    // test indexing of core-like workspace
    const context = new WorkspaceContext('test-workspaces/sfdx-workspace');
    await context.configureAndIndex();
    // check attributes
    expect(getLwcByTag('c-todo_item').attributes).toEqual([{ detail: 'LWC custom attribute', documentation: 'todo jsdoc', jsName: 'todo', name: 'todo' }]);
    expect(getLwcByTag('c-todo_util').attributes).toEqual([
        { detail: 'LWC custom attribute', jsName: 'info', name: 'info' },
        { detail: 'LWC custom attribute', jsName: 'iconName', name: 'icon-name' },
        { detail: 'LWC custom attribute', jsName: 'upperCASE', name: 'upper-c-a-s-e' },
    ]);
    // check standard components
    expect(getLwcByTag('lightning-button')).not.toBeUndefined();
    expect(getLwcByTag('lightning-button').documentation).toBe('Represents a button element.');
    expect(getLwcByTag('lightning-button').attributes[0]).toEqual({
        detail: 'LWC standard attribute',
        documentation: 'Specifies a shortcut key to activate or focus an element.',
        jsName: 'accesskey',
        name: 'accesskey',
    });
    // check Location
    const uri = getLwcByTag('c-todo_item').location.uri;
    expect(URI.parse(uri).fsPath).toExist();
    expect(uri).toEndWith('/test-workspaces/sfdx-workspace/force-app/main/default/lightningcomponents/todo_item/todo_item.js');
});

it('indexCore', async () => {
    // test indexing of core-like workspace
    const context = new WorkspaceContext('test-workspaces/core-like-workspace/app/main/core');
    await context.configureAndIndex();
    // check attributes
    expect(getLwcByTag('one-app-nav-bar').attributes).toEqual([]);
    expect(getLwcByTag('force-input-phone').attributes).toEqual([{ detail: 'LWC custom attribute', jsName: 'value', name: 'value' }]);
    // check standard components
    expect(getLwcByTag('lightning-button')).not.toBeUndefined();
    // check Location
    const uri = getLwcByTag('one-app-nav-bar').location.uri;
    expect(URI.parse(uri).fsPath).toExist();
    expect(uri).toEndWith('/test-workspaces/core-like-workspace/app/main/core/ui-global-components/modules/one/app-nav-bar/app-nav-bar.js');
});

it('indexStandard', async () => {
    const context = new WorkspaceContext('test-workspaces/standard-workspace');
    await context.configureAndIndex();
    // check attributes
    expect(getLwcByTag('example-line').attributes).toEqual([
        { detail: 'LWC custom attribute', jsName: 'hover', name: 'hover' },
        { detail: 'LWC custom attribute', jsName: 'text', name: 'text' },
    ]);
    expect(getLwcByTag('lightning-ito').attributes).toEqual([
        { detail: 'LWC custom attribute', documentation: undefined, jsName: 'attr', location: undefined, name: 'attr' },
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
