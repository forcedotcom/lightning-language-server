import { WorkspaceContext } from '../context';
import { readAsTextDocument } from './test-utils';

function namespaceRoots(context: WorkspaceContext): string[] {
    // tslint:disable-next-line:no-string-literal
    return context['namespaceRoots'];
}

it('WorkspaceContext', async () => {
    let context = WorkspaceContext.createFrom('test-workspaces/test-force-app-metadata');
    expect(context.workspaceRoot).toBeAbsolute();
    let roots = namespaceRoots(context);
    expect(roots[0]).toBeAbsolute();
    expect(roots[0]).toEndWith('test-workspaces/test-force-app-metadata/lightningcomponents');
    let modules = context.findAllModules();
    expect(modules[0]).toEndWith('test-workspaces/test-force-app-metadata/lightningcomponents/hello_world/hello_world.js');
    expect(modules[9]).toEndWith('test-workspaces/test-force-app-metadata/lightningcomponents/wire_lds/wire_lds.js');
    expect(modules.length).toBe(10);

    context = WorkspaceContext.createFrom('test-workspaces/regular-workspace');
    roots = namespaceRoots(context);
    expect(roots[0]).toEndWith('test-workspaces/regular-workspace/src/modules/example');
    expect(roots[1]).toEndWith('test-workspaces/regular-workspace/src/modules/other');
    expect(roots.length).toBe(2);
    modules = context.findAllModules();
    expect(modules[0]).toEndWith('test-workspaces/regular-workspace/src/modules/example/app/app.js');
    expect(modules[1]).toEndWith('test-workspaces/regular-workspace/src/modules/example/line/line.js');
    expect(modules[2]).toEndWith('test-workspaces/regular-workspace/src/modules/other/text/text.js');
    expect(modules.length).toBe(3);

    context = WorkspaceContext.createFrom('test-workspaces/core-like-workspace');
    roots = namespaceRoots(context);
    expect(roots[0]).toEndWith('test-workspaces/core-like-workspace/core/ui-force-components/modules/force');
    expect(roots[1]).toEndWith('test-workspaces/core-like-workspace/core/ui-global-components/modules/one');
    expect(roots.length).toBe(2);
    modules = context.findAllModules();
    expect(modules[0]).toEndWith('test-workspaces/core-like-workspace/core/ui-force-components/modules/force/input-phone/input-phone.js');
    expect(modules[1]).toEndWith('test-workspaces/core-like-workspace/core/ui-global-components/modules/one/app-nav-bar/app-nav-bar.js');
    expect(modules.length).toBe(2);

    // console.log('core roots:', utils.findNamespaceRoots('/Users/rsalvador/blt/app/main/core'));
});

it('utils.isInsideModulesRoots()', () => {
    const context = WorkspaceContext.createFrom('test-workspaces/test-force-app-metadata');

    let document = readAsTextDocument('test-workspaces/test-force-app-metadata/lightningcomponents/hello_world/hello_world.js');
    expect(context.isInsideModulesRoots(document)).toBeTruthy();

    document = readAsTextDocument('test-workspaces/test-force-app-metadata/aura/helloWorldApp/helloWorldApp.app');
    expect(context.isInsideModulesRoots(document)).toBeFalsy();
});

it('utils.isLWCTemplate()', () => {
    const context = WorkspaceContext.createFrom('test-workspaces/test-force-app-metadata');

    // .js is not a template
    let document = readAsTextDocument('test-workspaces/test-force-app-metadata/lightningcomponents/hello_world/hello_world.js');
    expect(context.isLWCTemplate(document)).toBeFalsy();

    // .html is a template
    document = readAsTextDocument('test-workspaces/test-force-app-metadata/lightningcomponents/hello_world/hello_world.html');
    expect(context.isLWCTemplate(document)).toBeTruthy();

    // aura cmps are not a template (sfdx assigns the 'html' language id to aura components)
    document = readAsTextDocument('test-workspaces/test-force-app-metadata/aura/helloWorldApp/helloWorldApp.app');
    expect(context.isLWCTemplate(document)).toBeFalsy();

    // html outside namespace roots is not a template
    document = readAsTextDocument('test-workspaces/test-force-app-metadata/aura/todoApp/randomHtmlInAuraFolder.html');
    expect(context.isLWCTemplate(document)).toBeFalsy();
});

it('utils.isLWCJavascript()', () => {
    const context = WorkspaceContext.createFrom('test-workspaces/test-force-app-metadata');

    // lwc .js
    let document = readAsTextDocument('test-workspaces/test-force-app-metadata/lightningcomponents/hello_world/hello_world.js');
    expect(context.isLWCJavascript(document)).toBeTruthy();

    // lwc .htm
    document = readAsTextDocument('test-workspaces/test-force-app-metadata/lightningcomponents/hello_world/hello_world.html');
    expect(context.isLWCJavascript(document)).toBeFalsy();

    // aura cmps
    document = readAsTextDocument('test-workspaces/test-force-app-metadata/aura/helloWorldApp/helloWorldApp.app');
    expect(context.isLWCJavascript(document)).toBeFalsy();

    // .js outside namespace roots
    document = readAsTextDocument('test-workspaces/test-force-app-metadata/aura/todoApp/randomJsInAuraFolder.js');
    expect(context.isLWCJavascript(document)).toBeFalsy();
});

// TODO: .js outside namespace roots:
