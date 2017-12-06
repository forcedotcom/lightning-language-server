import { getLwcByTag, addCustomTagFromFile } from '../custom-components-util';

it('addCustomTagFromFile(): adds custom tag and attributes', async () => {
    // custom tag is not indexed initially
    let tagInfo = getLwcByTag('c-todo_item');
    expect(tagInfo).toBeUndefined();

    // index todo_item.js ==> custom tag and attributes are added to the index
    await addCustomTagFromFile('test-workspaces/test-force-app-metadata/lightningcomponents/todo_item/todo_item.js',
        true);
    tagInfo = getLwcByTag('c-todo_item');
    expect(tagInfo).toMatchObject({ attributes: ['todo'] });
});
