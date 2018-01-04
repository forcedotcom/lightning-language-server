import { getLwcByTag, addCustomTagFromFile, indexCustomComponents } from '../custom-components-util';
import { WorkspaceContext } from '../../context';
import URI from 'vscode-uri';

it('addCustomTagFromFile(): adds custom tag attributes and documentation', async () => {
    // custom tag is not indexed initially
    let tagInfo = getLwcByTag('c-todo_item');
    expect(tagInfo).toBeUndefined();

    // index todo_item.js ==> custom tag and attributes are added to the index
    await addCustomTagFromFile('test-workspaces/sfdx-workspace/force-app/main/default/lightningcomponents/todo_item/todo_item.js',
        true);
    tagInfo = getLwcByTag('c-todo_item');
    expect(tagInfo).toMatchObject({ attributes: ['todo'], documentation: 'TodoItem doc' });
    const location = tagInfo.location;
    expect(URI.parse(location.uri).path).toExist();
    expect(location.uri).toEndWith('/test-workspaces/sfdx-workspace/force-app/main/default/lightningcomponents/todo_item/todo_item.js');
    expect(location.range.start.line).toBe(6);
});

it('indexLwc', async () => {
    // test indexing of core-like workspace
    const context = new WorkspaceContext('test-workspaces/core-like-workspace/core');
    await indexCustomComponents(context);
    // check attributes
    expect(getLwcByTag('one-app-nav-bar').attributes).toEqual([]);
    expect(getLwcByTag('force-input-phone').attributes).toEqual([ 'value' ]);
    // check Location
    const uri = getLwcByTag('one-app-nav-bar').location.uri;
    expect(URI.parse(uri).path).toExist();
    expect(uri).toEndWith('/test-workspaces/core-like-workspace/core/ui-global-components/modules/one/app-nav-bar/app-nav-bar.js');
});
