import { WorkspaceContext, WorkspaceType } from '../context';
import { readAsTextDocument } from './test-utils';
import * as fs from 'fs-extra';

const FORCE_APP_ROOT = 'test-workspaces/sfdx-workspace/force-app/main/default';
const UTILS_ROOT = 'test-workspaces/sfdx-workspace/utils/meta';
const CORE_ALL_ROOT = 'test-workspaces/core-like-workspace/core';
const CORE_PROJECT_ROOT = CORE_ALL_ROOT + '/ui-global-components';

function namespaceRoots(context: WorkspaceContext): string[] {
    // tslint:disable-next-line:no-string-literal
    return context['namespaceRoots'];
}

it('WorkspaceContext', async () => {
    let context = new WorkspaceContext('test-workspaces/sfdx-workspace');
    expect(context.type).toBe(WorkspaceType.SFDX);
    expect(context.workspaceRoot).toBeAbsolutePath();
    let roots = namespaceRoots(context);
    expect(roots[0]).toBeAbsolutePath();
    expect(roots[0]).toEndWith(FORCE_APP_ROOT + '/lightningcomponents');
    expect(roots[1]).toEndWith(UTILS_ROOT + '/lightningcomponents');
    expect(roots.length).toBe(2);
    let modules = context.findAllModules();
    expect(modules[0]).toEndWith(FORCE_APP_ROOT + '/lightningcomponents/hello_world/hello_world.js');
    expect(modules[9]).toEndWith(FORCE_APP_ROOT + '/lightningcomponents/wire_lds/wire_lds.js');
    expect(modules[10]).toEndWith(UTILS_ROOT + '/lightningcomponents/todo_util/todo_util.js');
    expect(modules.length).toBe(11);

    context = new WorkspaceContext('test-workspaces/standard-workspace');
    roots = namespaceRoots(context);
    expect(context.type).toBe(WorkspaceType.STANDARD);
    expect(roots[0]).toEndWith('test-workspaces/standard-workspace/src/modules/example');
    expect(roots[1]).toEndWith('test-workspaces/standard-workspace/src/modules/other');
    expect(roots.length).toBe(2);
    modules = context.findAllModules();
    expect(modules[0]).toEndWith('test-workspaces/standard-workspace/src/modules/example/app/app.js');
    expect(modules[1]).toEndWith('test-workspaces/standard-workspace/src/modules/example/line/line.js');
    expect(modules[2]).toEndWith('test-workspaces/standard-workspace/src/modules/other/text/text.js');
    expect(modules.length).toBe(3);

    context = new WorkspaceContext(CORE_ALL_ROOT);
    expect(context.type).toBe(WorkspaceType.CORE_ALL);
    roots = namespaceRoots(context);
    expect(roots[0]).toEndWith(CORE_ALL_ROOT + '/ui-force-components/modules/force');
    expect(roots[1]).toEndWith(CORE_ALL_ROOT + '/ui-global-components/modules/one');
    expect(roots.length).toBe(2);
    modules = context.findAllModules();
    expect(modules[0]).toEndWith(CORE_ALL_ROOT + '/ui-force-components/modules/force/input-phone/input-phone.js');
    expect(modules[1]).toEndWith(CORE_ALL_ROOT + '/ui-global-components/modules/one/app-nav-bar/app-nav-bar.js');
    expect(modules.length).toBe(2);

    context = new WorkspaceContext(CORE_PROJECT_ROOT);
    expect(context.type).toBe(WorkspaceType.CORE_PROJECT);
    roots = namespaceRoots(context);
    expect(roots[0]).toEndWith(CORE_PROJECT_ROOT + '/modules/one');
    expect(roots.length).toBe(1);
    modules = context.findAllModules();
    expect(modules[0]).toEndWith(CORE_PROJECT_ROOT + '/modules/one/app-nav-bar/app-nav-bar.js');
    expect(modules.length).toBe(1);

    // console.log('core roots:', utils.findNamespaceRoots('/Users/rsalvador/blt/app/main/core'));
});

it('isInsideModulesRoots()', () => {
    const context = new WorkspaceContext('test-workspaces/sfdx-workspace');

    let document = readAsTextDocument(FORCE_APP_ROOT + '/lightningcomponents/hello_world/hello_world.js');
    expect(context.isInsideModulesRoots(document)).toBeTruthy();

    document = readAsTextDocument(FORCE_APP_ROOT + '/aura/helloWorldApp/helloWorldApp.app');
    expect(context.isInsideModulesRoots(document)).toBeFalsy();

    document = readAsTextDocument(UTILS_ROOT + '/lightningcomponents/todo_util/todo_util.js');
    expect(context.isInsideModulesRoots(document)).toBeTruthy();
});

it('isLWCTemplate()', () => {
    const context = new WorkspaceContext('test-workspaces/sfdx-workspace');

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
    const context = new WorkspaceContext('test-workspaces/sfdx-workspace');

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
    const context = new WorkspaceContext('test-workspaces/sfdx-workspace');
    const jsconfigPathForceApp = FORCE_APP_ROOT + '/lightningcomponents/jsconfig.json';
    const jsconfigPathUtilsOrig = UTILS_ROOT + '/lightningcomponents/jsconfig-orig.json';
    const jsconfigPathUtils = UTILS_ROOT + '/lightningcomponents/jsconfig.json';
    const eslintrcPathForceApp = FORCE_APP_ROOT + '/lightningcomponents/.eslintrc.json';
    const eslintrcPathUtilsOrig = UTILS_ROOT + '/lightningcomponents/eslintrc-orig.json';
    const eslintrcPathUtils = UTILS_ROOT + '/lightningcomponents/.eslintrc.json';
    const sfdxTypingsPath = 'test-workspaces/sfdx-workspace/.sfdx/typings/lwc';
    const forceignorePath = 'test-workspaces/sfdx-workspace/.forceignore';

    // make sure no generated files are there from previous runs
    fs.removeSync(jsconfigPathForceApp);
    fs.removeSync(eslintrcPathForceApp);
    fs.copySync(jsconfigPathUtilsOrig, jsconfigPathUtils);
    fs.copySync(eslintrcPathUtilsOrig, eslintrcPathUtils);
    fs.removeSync(forceignorePath);
    fs.removeSync(sfdxTypingsPath);

    // verify typings/jsconfig after configuration:

    expect(jsconfigPathUtils).toExist();
    expect(eslintrcPathUtils).toExist();
    context.configureProject();

    // tslint:disable-next-line no-string-literal
    expect(context['sfdxPackageDirsPattern']).toBe('{force-app,utils}');

    // verify newly created jsconfig.json
    const jsconfigForceAppContent = fs.readFileSync(jsconfigPathForceApp, { encoding: 'utf-8' });
    expect(jsconfigForceAppContent).toContain('    "compilerOptions": {'); // check formatting
    const jsconfigForceApp = JSON.parse(jsconfigForceAppContent);
    expect(jsconfigForceApp.compilerOptions.experimentalDecorators).toBe(true);
    expect(jsconfigForceApp.include[0]).toBe('**/*');
    expect(jsconfigForceApp.include[1]).toMatch(/test-workspaces\/sfdx-workspace\/.sfdx\/typings\/lwc\/\*\*\/\*.d.ts$/);
    // verify updated jsconfig.json
    const jsconfigUtilsContent = fs.readFileSync(jsconfigPathUtils, { encoding: 'utf-8' });
    expect(jsconfigUtilsContent).toContain('    "compilerOptions": {'); // check formatting
    const jsconfigUtils = JSON.parse(jsconfigUtilsContent);
    expect(jsconfigUtils.compilerOptions.target).toBe('es2017');
    expect(jsconfigUtils.compilerOptions.experimentalDecorators).toBe(true);
    expect(jsconfigUtils.include[0]).toBe('util/*.js');
    expect(jsconfigUtils.include[1]).toBe('**/*');
    expect(jsconfigUtils.include[2]).toMatch(/test-workspaces\/sfdx-workspace\/.sfdx\/typings\/lwc\/\*\*\/\*.d.ts$/);

    // verify newly created .eslintrc.json
    const eslintrcForceAppContent = fs.readFileSync(eslintrcPathForceApp, { encoding: 'utf-8' });
    expect(eslintrcForceAppContent).toContain('    "extends": "plugin:lwc/recommended",'); // check formatting
    const eslintrcForceApp = JSON.parse(eslintrcForceAppContent);
    expect(eslintrcForceApp.extends).toBe('plugin:lwc/recommended');
    expect(eslintrcForceApp.plugins[0]).toBe('lwc');
    // verify updated .eslintrc.json
    const eslintrcUtilsContent = fs.readFileSync(eslintrcPathUtils, { encoding: 'utf-8' });
    expect(eslintrcUtilsContent).toContain('    "extends": "plugin:lwc/recommended",'); // check formatting
    const eslintrcUtils = JSON.parse(eslintrcUtilsContent);
    expect(eslintrcUtils.extends).toBe('plugin:lwc/recommended');
    expect(eslintrcUtils.plugins[0]).toBe('lwc');
    expect(eslintrcUtils.rules.semi).toBe('error');

    // .forceignore
    const forceignoreContent = fs.readFileSync(forceignorePath, { encoding: 'utf-8' });
    expect(forceignoreContent).toContain('force-app/main/default/lightningcomponents/jsconfig.json');
    expect(forceignoreContent).toContain('utils/meta/lightningcomponents/jsconfig.json');
    expect(forceignoreContent).toContain('force-app/main/default/lightningcomponents/.eslintrc.json');
    expect(forceignoreContent).toContain('utils/meta/lightningcomponents/.eslintrc.json');

    // typings
    expect(sfdxTypingsPath + '/engine.d.ts').toExist();
    expect(sfdxTypingsPath + '/lwc.d.ts').toExist();
});

it('configureCoreProject()', () => {
    const context = new WorkspaceContext(CORE_PROJECT_ROOT);
    const jsconfigPath = CORE_PROJECT_ROOT + '/modules/jsconfig.json';
    const typingsPath = 'test-workspaces/core-like-workspace/core/.vscode/typings/lwc';

    // make sure no generated files are there from previous runs
    fs.removeSync(jsconfigPath);
    fs.removeSync(typingsPath);

    // configure and verify typings/jsconfig after configuration:
    context.configureProject();

    verifyJsconfigCore(jsconfigPath);
    verifyTypingsCore();
});

it('configureCoreAll()', () => {
    const context = new WorkspaceContext(CORE_ALL_ROOT);
    const jsconfigPathGlobal = CORE_ALL_ROOT + '/ui-global-components/modules/jsconfig.json';
    const jsconfigPathForce = CORE_ALL_ROOT + '/ui-force-components/modules/jsconfig.json';

    // make sure no generated files are there from previous runs
    fs.removeSync(jsconfigPathGlobal);
    fs.removeSync(jsconfigPathForce);

    // configure and verify typings/jsconfig after configuration:
    context.configureProject();

    // verify newly created jsconfig.json
    verifyJsconfigCore(jsconfigPathGlobal);
    verifyJsconfigCore(jsconfigPathForce);
    verifyTypingsCore();
});

function verifyJsconfigCore(jsconfigPath: string) {
    const jsconfigContent = fs.readFileSync(jsconfigPath, { encoding: 'utf-8' });
    expect(jsconfigContent).toContain('    "compilerOptions": {'); // check formatting
    const jsconfig = JSON.parse(jsconfigContent);
    expect(jsconfig.compilerOptions.experimentalDecorators).toBe(true);
    expect(jsconfig.include[0]).toBe('**/*');
    expect(jsconfig.include[1]).toMatch(/test-workspaces\/core-like-workspace\/core\/.vscode\/typings\/lwc\/\*\*\/\*.d.ts$/);
    fs.removeSync(jsconfigPath);
}

function verifyTypingsCore() {
    const typingsPath = 'test-workspaces/core-like-workspace/core/.vscode/typings/lwc';
    expect(typingsPath + '/engine.d.ts').toExist();
    expect(typingsPath + '/lwc.d.ts').toExist();
    fs.removeSync(typingsPath);
}