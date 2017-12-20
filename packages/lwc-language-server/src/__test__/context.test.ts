import { WorkspaceContext } from '../context';
import { readAsTextDocument } from './test-utils';
import * as fs from 'fs-extra';

const FORCE_APP_ROOT = 'test-workspaces/sfdx-workspace/force-app/main/default';
const UTILS_ROOT = 'test-workspaces/sfdx-workspace/utils/meta';

function namespaceRoots(context: WorkspaceContext): string[] {
    // tslint:disable-next-line:no-string-literal
    return context['namespaceRoots'];
}

it('WorkspaceContext', async () => {
    let context = WorkspaceContext.createFrom('test-workspaces/sfdx-workspace');
    expect(context.workspaceRoot).toBeAbsolute();
    let roots = namespaceRoots(context);
    expect(roots[0]).toBeAbsolute();
    expect(roots[0]).toEndWith(FORCE_APP_ROOT + '/lightningcomponents');
    let modules = context.findAllModules();
    expect(modules[0]).toEndWith(FORCE_APP_ROOT + '/lightningcomponents/hello_world/hello_world.js');
    expect(modules[9]).toEndWith(FORCE_APP_ROOT + '/lightningcomponents/wire_lds/wire_lds.js');
    expect(modules[10]).toEndWith(UTILS_ROOT + '/lightningcomponents/todo_util/todo_util.js');
    expect(modules.length).toBe(11);

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

it('isInsideModulesRoots()', () => {
    const context = WorkspaceContext.createFrom('test-workspaces/sfdx-workspace');

    let document = readAsTextDocument(FORCE_APP_ROOT + '/lightningcomponents/hello_world/hello_world.js');
    expect(context.isInsideModulesRoots(document)).toBeTruthy();

    document = readAsTextDocument(FORCE_APP_ROOT + '/aura/helloWorldApp/helloWorldApp.app');
    expect(context.isInsideModulesRoots(document)).toBeFalsy();

    document = readAsTextDocument(UTILS_ROOT + '/lightningcomponents/todo_util/todo_util.js');
    expect(context.isInsideModulesRoots(document)).toBeTruthy();
});

it('isLWCTemplate()', () => {
    const context = WorkspaceContext.createFrom('test-workspaces/sfdx-workspace');

    // .js is not a template
    let document = readAsTextDocument(FORCE_APP_ROOT + '/lightningcomponents/hello_world/hello_world.js');
    expect(context.isLWCTemplate(document)).toBeFalsy();

    // .html is a template
    document = readAsTextDocument(FORCE_APP_ROOT + '/lightningcomponents/hello_world/hello_world.html');
    expect(context.isLWCTemplate(document)).toBeTruthy();

    // aura cmps are not a template (sfdx assigns the 'html' language id to aura components)
    document = readAsTextDocument(FORCE_APP_ROOT + '/aura/helloWorldApp/helloWorldApp.app');
    expect(context.isLWCTemplate(document)).toBeFalsy();

    // html outside namespace roots is not a template
    document = readAsTextDocument(FORCE_APP_ROOT + '/aura/todoApp/randomHtmlInAuraFolder.html');
    expect(context.isLWCTemplate(document)).toBeFalsy();

    // .html in utils folder is a template
    document = readAsTextDocument(UTILS_ROOT + '/lightningcomponents/todo_util/todo_util.html');
    expect(context.isLWCTemplate(document)).toBeTruthy();
});

it('isLWCJavascript()', () => {
    const context = WorkspaceContext.createFrom('test-workspaces/sfdx-workspace');

    // lwc .js
    let document = readAsTextDocument(FORCE_APP_ROOT + '/lightningcomponents/hello_world/hello_world.js');
    expect(context.isLWCJavascript(document)).toBeTruthy();

    // lwc .htm
    document = readAsTextDocument(FORCE_APP_ROOT + '/lightningcomponents/hello_world/hello_world.html');
    expect(context.isLWCJavascript(document)).toBeFalsy();

    // aura cmps
    document = readAsTextDocument(FORCE_APP_ROOT + '/aura/helloWorldApp/helloWorldApp.app');
    expect(context.isLWCJavascript(document)).toBeFalsy();

    // .js outside namespace roots
    document = readAsTextDocument(FORCE_APP_ROOT + '/aura/todoApp/randomJsInAuraFolder.js');
    expect(context.isLWCJavascript(document)).toBeFalsy();

    // lwc .js in utils
    document = readAsTextDocument(UTILS_ROOT + '/lightningcomponents/todo_util/todo_util.js');
    expect(context.isLWCJavascript(document)).toBeTruthy();
});

it('configureSfdxProject()', () => {
    const context = WorkspaceContext.createFrom('test-workspaces/sfdx-workspace');
    const jsconfigPathForceApp = FORCE_APP_ROOT + '/lightningcomponents/jsconfig.json';
    const jsconfigPathUtils = UTILS_ROOT + '/lightningcomponents/jsconfig.json';
    const sfdxTypingsPath = 'test-workspaces/sfdx-workspace/.sfdx/typings/lwc';

    // make sure no typings/jsconfig.json are there from previous run
    fs.removeSync(jsconfigPathForceApp);
    fs.removeSync(jsconfigPathUtils);
    fs.removeSync(sfdxTypingsPath);

    // verify typings/jsconfig after configuration:

    context.configureSfdxProject();

    // tslint:disable-next-line no-string-literal
    expect(context['sfdxPackageDirsPattern']).toBe('{force-app,utils}');

    const configForceApp = JSON.parse(fs.readFileSync(jsconfigPathForceApp, { encoding: 'utf-8' }));
    expect(configForceApp.compilerOptions.experimentalDecorators).toBe(true);
    expect(configForceApp.include[0]).toBe('**/*');
    expect(configForceApp.include[1]).toMatch(/test-workspaces\/sfdx-workspace\/.sfdx\/typings\/lwc\/\*\*\/\*.d.ts$/);
    const configUtils = JSON.parse(fs.readFileSync(jsconfigPathUtils, { encoding: 'utf-8' }));
    expect(configUtils.compilerOptions.experimentalDecorators).toBe(true);
    expect(configUtils.include[0]).toBe('**/*');
    expect(configUtils.include[1]).toMatch(/test-workspaces\/sfdx-workspace\/.sfdx\/typings\/lwc\/\*\*\/\*.d.ts$/);

    expect(sfdxTypingsPath + '/engine.d.ts').toExist();
    expect(sfdxTypingsPath + '/lwc.d.ts').toExist();
});

// TODO: .js outside namespace roots:
