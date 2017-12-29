import { getLwcByTag, addCustomTagFromFile, indexCustomComponents } from '../custom-components-util';
import { WorkspaceContext } from '../../context';

it('addCustomTagFromFile(): adds custom tag attributes and documentation', async () => {
    // custom tag is not indexed initially
    let tagInfo = getLwcByTag('c-todo_item');
    expect(tagInfo).toBeUndefined();

    // index todo_item.js ==> custom tag and attributes are added to the index
    await addCustomTagFromFile('test-workspaces/sfdx-workspace/force-app/main/default/lightningcomponents/todo_item/todo_item.js',
        true);
    tagInfo = getLwcByTag('c-todo_item');
    expect(tagInfo).toMatchObject({ attributes: ['todo'], documentation: '[doc placeholder]' });
});

it('indexLwc', async () => {
    // test indexing of core-like workspace
    const context = new WorkspaceContext('test-workspaces/core-like-workspace/core');
    await indexCustomComponents(context);
    expect(getLwcByTag('app-nav-bar').attributes).toEqual([]);
    expect(getLwcByTag('input-phone').attributes).toEqual([ 'value' ]);
});
