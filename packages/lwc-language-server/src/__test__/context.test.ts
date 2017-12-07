import { WorkspaceContext } from '../context';

it('WorkspaceContext', async () => {
    let context = WorkspaceContext.createFrom('test-workspaces/test-force-app-metadata');
    expect(context.namespaceRoots).toEqual(['test-workspaces/test-force-app-metadata/lightningcomponents']);
    let modules = context.findAllModules();
    expect(modules).toContain('test-workspaces/test-force-app-metadata/lightningcomponents/hello_world/hello_world.js');
    expect(modules).toContain('test-workspaces/test-force-app-metadata/lightningcomponents/wire_lds/wire_lds.js');
    expect(modules.length).toBe(10);

    context = WorkspaceContext.createFrom('test-workspaces/regular-workspace');
    expect(context.namespaceRoots).toEqual(['test-workspaces/regular-workspace/src/modules/example',
        'test-workspaces/regular-workspace/src/modules/other']);
    modules = context.findAllModules();
    expect(modules).toEqual(['test-workspaces/regular-workspace/src/modules/example/app/app.js'
        , 'test-workspaces/regular-workspace/src/modules/example/line/line.js'
        , 'test-workspaces/regular-workspace/src/modules/other/text/text.js']);

    context = WorkspaceContext.createFrom('test-workspaces/core-like-workspace');
    expect(context.namespaceRoots).toEqual([
        'test-workspaces/core-like-workspace/core/ui-force-components/modules/force',
        'test-workspaces/core-like-workspace/core/ui-global-components/modules/one']);
    modules = context.findAllModules();
    expect(modules).toEqual([
        'test-workspaces/core-like-workspace/core/ui-force-components/modules/force/input-phone/input-phone.js',
        'test-workspaces/core-like-workspace/core/ui-global-components/modules/one/app-nav-bar/app-nav-bar.js']);

    // console.log('core roots:', utils.findNamespaceRoots('/Users/rsalvador/blt/app/main/core'));
});
