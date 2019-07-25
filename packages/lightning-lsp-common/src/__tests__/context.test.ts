import * as fs from 'fs-extra';
import { join } from 'path';
import { WorkspaceContext } from '../context';
import { WorkspaceType } from '../shared';
import * as utils from '../utils';
import {
    CORE_ALL_ROOT,
    CORE_PROJECT_ROOT,
    FORCE_APP_ROOT,
    STANDARDS_ROOT,
    UTILS_ROOT,
    readAsTextDocument,
    REGISTERED_EMPTY_FOLDER_ROOT,
    CORE_MULTI_ROOT,
    SFDX_ROOT,
    SFDX_MULTI_ROOT,
} from './test-utils';

it('WorkspaceContext', async () => {
    let context = new WorkspaceContext(SFDX_ROOT);
    expect(context.type).toBe(WorkspaceType.SFDX);
    expect(context.workspaceRoots[0]).toBeAbsolutePath();
    let roots = await context.getNamespaceRoots();
    expect(roots.lwc[0]).toBeAbsolutePath();
    expect(roots.lwc[0]).toEndWith(join(SFDX_ROOT, FORCE_APP_ROOT, 'lwc'));
    expect(roots.lwc[1]).toEndWith(join(SFDX_ROOT, UTILS_ROOT, 'lwc'));
    expect(roots.lwc[2]).toEndWith(join(SFDX_ROOT, REGISTERED_EMPTY_FOLDER_ROOT, 'lwc'));
    expect(roots.lwc.length).toBe(3);
    let modules = await context.findAllModules();
    expect(modules[0]).toEndWith(join(SFDX_ROOT, FORCE_APP_ROOT, '/lwc/hello_world/hello_world.js'));
    expect(modules[8]).toEndWith(join(SFDX_ROOT, UTILS_ROOT, '/lwc/todo_util/todo_util.js'));
    expect(modules.length).toBe(10);
    expect((await context.getModulesDirs()).length).toBe(3);

    context = new WorkspaceContext(SFDX_MULTI_ROOT);
    expect(context.type).toBe(WorkspaceType.SFDX);
    roots = await context.getNamespaceRoots();
    expect(roots.lwc[0]).toBeAbsolutePath();
    expect(roots.lwc[0]).toEndWith(join(context.workspaceRoots[0], FORCE_APP_ROOT, 'lwc'));
    expect(roots.lwc[1]).toEndWith(join(context.workspaceRoots[0], UTILS_ROOT, 'lwc'));
    expect(roots.lwc[2]).toEndWith(join(context.workspaceRoots[0], REGISTERED_EMPTY_FOLDER_ROOT, 'lwc'));
    expect(roots.lwc[3]).toEndWith(join(context.workspaceRoots[1], FORCE_APP_ROOT, 'lwc'));
    expect(roots.lwc[4]).toEndWith(join(context.workspaceRoots[1], UTILS_ROOT, 'lwc'));
    expect(roots.lwc[5]).toEndWith(join(context.workspaceRoots[1], REGISTERED_EMPTY_FOLDER_ROOT, 'lwc'));
    expect(roots.lwc.length).toBe(6);

    context = new WorkspaceContext('test-workspaces/standard-workspace');
    roots = await context.getNamespaceRoots();
    expect(context.type).toBe(WorkspaceType.STANDARD_LWC);
    expect(roots.lwc[0]).toEndWith(join(STANDARDS_ROOT, 'example'));
    expect(roots.lwc[1]).toEndWith(join(STANDARDS_ROOT, 'interop'));
    expect(roots.lwc[2]).toEndWith(join(STANDARDS_ROOT, 'other'));
    expect(roots.lwc.length).toBe(3);
    modules = await context.findAllModules();
    expect(modules[0]).toEndWith(join(STANDARDS_ROOT, 'example', 'app', 'app.js'));
    expect(modules[1]).toEndWith(join(STANDARDS_ROOT, 'example', 'line', 'line.js'));
    expect(modules[2]).toEndWith(join(STANDARDS_ROOT, 'interop', 'ito', 'ito.js'));
    expect(modules[3]).toEndWith(join(STANDARDS_ROOT, 'other', 'text', 'text.js'));
    expect(modules.length).toBe(4);
    expect(await context.getModulesDirs()).toEqual([]);

    context = new WorkspaceContext(CORE_ALL_ROOT);
    expect(context.type).toBe(WorkspaceType.CORE_ALL);
    roots = await context.getNamespaceRoots();
    expect(roots.lwc[0]).toEndWith(join(CORE_ALL_ROOT, 'ui-force-components/modules/clients'));
    expect(roots.lwc[1]).toEndWith(join(CORE_ALL_ROOT, 'ui-force-components/modules/force'));
    expect(roots.lwc[2]).toEndWith(join(CORE_ALL_ROOT, 'ui-global-components/modules/one'));
    expect(roots.lwc.length).toBe(3);
    modules = await context.findAllModules();
    expect(modules[0]).toEndWith(join(CORE_ALL_ROOT, '/ui-force-components/modules/clients/context-library-lwc/context-library-lwc.js'));
    expect(modules[1]).toEndWith(join(CORE_ALL_ROOT, '/ui-force-components/modules/force/input-phone/input-phone.js'));
    expect(modules[2]).toEndWith(join(CORE_ALL_ROOT, '/ui-global-components/modules/one/app-nav-bar/app-nav-bar.js'));
    expect(modules.length).toBe(3);
    expect((await context.getModulesDirs()).length).toBe(2);

    context = new WorkspaceContext(CORE_PROJECT_ROOT);
    expect(context.type).toBe(WorkspaceType.CORE_PARTIAL);
    roots = await context.getNamespaceRoots();
    expect(roots.lwc[0]).toEndWith(join(CORE_PROJECT_ROOT, 'modules', 'one'));
    expect(roots.lwc.length).toBe(1);
    modules = await context.findAllModules();
    expect(modules[0]).toEndWith(join(CORE_PROJECT_ROOT, 'modules', 'one', 'app-nav-bar', 'app-nav-bar.js'));
    expect(modules.length).toBe(1);
    expect(await context.getModulesDirs()).toEqual([join(context.workspaceRoots[0], 'modules')]);

    context = new WorkspaceContext(CORE_MULTI_ROOT);
    expect(context.workspaceRoots.length).toBe(2);
    roots = await context.getNamespaceRoots();
    expect(roots.lwc[0]).toEndWith(join(CORE_ALL_ROOT, 'ui-force-components/modules/clients'));
    expect(roots.lwc[1]).toEndWith(join(CORE_ALL_ROOT, 'ui-force-components/modules/force'));
    expect(roots.lwc[2]).toEndWith(join(CORE_ALL_ROOT, 'ui-global-components/modules/one'));
    expect(roots.lwc.length).toBe(3);
    modules = await context.findAllModules();
    expect(modules[0]).toEndWith(join(CORE_ALL_ROOT, '/ui-force-components/modules/clients/context-library-lwc/context-library-lwc.js'));
    expect(modules[1]).toEndWith(join(CORE_ALL_ROOT, '/ui-force-components/modules/force/input-phone/input-phone.js'));
    expect(modules[2]).toEndWith(join(CORE_ALL_ROOT, '/ui-global-components/modules/one/app-nav-bar/app-nav-bar.js'));
    expect(modules.length).toBe(3);
    const modulesDirs = await context.getModulesDirs();
    for (let i = 0; i < context.workspaceRoots.length; i = i + 1) {
        expect(modulesDirs[i]).toMatch(context.workspaceRoots[i]);
    }
});

it('isInsideModulesRoots()', async () => {
    let context = new WorkspaceContext(SFDX_ROOT);

    let document = readAsTextDocument(SFDX_ROOT + '/' + FORCE_APP_ROOT + '/lwc/hello_world/hello_world.js');
    expect(await context.isInsideModulesRoots(document)).toBeTruthy();

    document = readAsTextDocument(SFDX_ROOT + '/' + FORCE_APP_ROOT + '/aura/helloWorldApp/helloWorldApp.app');
    expect(await context.isInsideModulesRoots(document)).toBeFalsy();

    document = readAsTextDocument(SFDX_ROOT + '/' + UTILS_ROOT + '/lwc/todo_util/todo_util.js');
    expect(await context.isInsideModulesRoots(document)).toBeTruthy();

    context = new WorkspaceContext(SFDX_MULTI_ROOT);

    document = readAsTextDocument(SFDX_MULTI_ROOT[0] + '/' + FORCE_APP_ROOT + '/lwc/hello_world/hello_world.js');
    expect(await context.isInsideModulesRoots(document)).toBeTruthy();

    document = readAsTextDocument(context.workspaceRoots[0] + '/' + FORCE_APP_ROOT + '/aura/helloWorldApp/helloWorldApp.app');
    expect(await context.isInsideModulesRoots(document)).toBeFalsy();

    document = readAsTextDocument(context.workspaceRoots[0] + '/' + UTILS_ROOT + '/lwc/todo_util/todo_util.js');
    expect(await context.isInsideModulesRoots(document)).toBeTruthy();

    document = readAsTextDocument(context.workspaceRoots[1] + '/' + FORCE_APP_ROOT + '/lwc/hello_world/hello_world.js');
    expect(await context.isInsideModulesRoots(document)).toBeTruthy();

    document = readAsTextDocument(context.workspaceRoots[1] + '/' + FORCE_APP_ROOT + '/aura/helloWorldApp/helloWorldApp.app');
    expect(await context.isInsideModulesRoots(document)).toBeFalsy();

    document = readAsTextDocument(context.workspaceRoots[1] + '/' + UTILS_ROOT + '/lwc/todo_util/todo_util.js');
    expect(await context.isInsideModulesRoots(document)).toBeTruthy();
});

// add isInside ModulesRoots
it('isLWCTemplate()', async () => {
    let context = new WorkspaceContext(SFDX_ROOT);

    // .js is not a template
    let document = readAsTextDocument(SFDX_ROOT + '/' + FORCE_APP_ROOT + '/lwc/hello_world/hello_world.js');
    expect(await context.isLWCTemplate(document)).toBeFalsy();

    // .html is a template
    document = readAsTextDocument(SFDX_ROOT + '/' + FORCE_APP_ROOT + '/lwc/hello_world/hello_world.html');
    expect(await context.isLWCTemplate(document)).toBeTruthy();

    // aura cmps are not a template (sfdx assigns the 'html' language id to aura components)
    document = readAsTextDocument(SFDX_ROOT + '/' + FORCE_APP_ROOT + '/aura/helloWorldApp/helloWorldApp.app');
    expect(await context.isLWCTemplate(document)).toBeFalsy();

    // html outside namespace roots is not a template
    document = readAsTextDocument(SFDX_ROOT + '/' + FORCE_APP_ROOT + '/aura/todoApp/randomHtmlInAuraFolder.html');
    expect(await context.isLWCTemplate(document)).toBeFalsy();

    // .html in utils folder is a template
    document = readAsTextDocument(SFDX_ROOT + '/' + UTILS_ROOT + '/lwc/todo_util/todo_util.html');
    expect(await context.isLWCTemplate(document)).toBeTruthy();

    context = new WorkspaceContext(SFDX_MULTI_ROOT);

    // .js is not a template
    document = readAsTextDocument(SFDX_MULTI_ROOT[0] + '/' + FORCE_APP_ROOT + '/lwc/hello_world/hello_world.js');
    expect(await context.isLWCTemplate(document)).toBeFalsy();

    // .html is a template
    document = readAsTextDocument(SFDX_MULTI_ROOT[0] + '/' + FORCE_APP_ROOT + '/lwc/hello_world/hello_world.html');
    expect(await context.isLWCTemplate(document)).toBeTruthy();

    // aura cmps are not a template (sfdx assigns the 'html' language id to aura components)
    document = readAsTextDocument(SFDX_MULTI_ROOT[0] + '/' + FORCE_APP_ROOT + '/aura/helloWorldApp/helloWorldApp.app');
    expect(await context.isLWCTemplate(document)).toBeFalsy();

    // html outside namespace roots is not a template
    document = readAsTextDocument(SFDX_MULTI_ROOT[0] + '/' + FORCE_APP_ROOT + '/aura/todoApp/randomHtmlInAuraFolder.html');
    expect(await context.isLWCTemplate(document)).toBeFalsy();

    // .html in utils folder is a template
    document = readAsTextDocument(SFDX_MULTI_ROOT[0] + '/' + UTILS_ROOT + '/lwc/todo_util/todo_util.html');
    expect(await context.isLWCTemplate(document)).toBeTruthy();

    // .js is not a template
    document = readAsTextDocument(SFDX_MULTI_ROOT[1] + '/' + FORCE_APP_ROOT + '/lwc/hello_world/hello_world.js');
    expect(await context.isLWCTemplate(document)).toBeFalsy();

    // .html is a template
    document = readAsTextDocument(SFDX_MULTI_ROOT[1] + '/' + FORCE_APP_ROOT + '/lwc/hello_world/hello_world.html');
    expect(await context.isLWCTemplate(document)).toBeTruthy();

    // aura cmps are not a template (sfdx assigns the 'html' language id to aura components)
    document = readAsTextDocument(SFDX_MULTI_ROOT[1] + '/' + FORCE_APP_ROOT + '/aura/helloWorldApp/helloWorldApp.app');
    expect(await context.isLWCTemplate(document)).toBeFalsy();

    // html outside namespace roots is not a template
    document = readAsTextDocument(SFDX_MULTI_ROOT[1] + '/' + FORCE_APP_ROOT + '/aura/todoApp/randomHtmlInAuraFolder.html');
    expect(await context.isLWCTemplate(document)).toBeFalsy();

    // .html in utils folder is a template
    document = readAsTextDocument(SFDX_MULTI_ROOT[1] + '/' + UTILS_ROOT + '/lwc/todo_util/todo_util.html');
    expect(await context.isLWCTemplate(document)).toBeTruthy();
});

it('isLWCJavascript()', async () => {
    let context = new WorkspaceContext(SFDX_ROOT);

    // lwc .js
    let document = readAsTextDocument(SFDX_ROOT + '/' + FORCE_APP_ROOT + '/lwc/hello_world/hello_world.js');
    expect(await context.isLWCJavascript(document)).toBeTruthy();

    // lwc .htm
    document = readAsTextDocument(SFDX_ROOT + '/' + FORCE_APP_ROOT + '/lwc/hello_world/hello_world.html');
    expect(await context.isLWCJavascript(document)).toBeFalsy();

    // aura cmps
    document = readAsTextDocument(SFDX_ROOT + '/' + FORCE_APP_ROOT + '/aura/helloWorldApp/helloWorldApp.app');
    expect(await context.isLWCJavascript(document)).toBeFalsy();

    // .js outside namespace roots
    document = readAsTextDocument(SFDX_ROOT + '/' + FORCE_APP_ROOT + '/aura/todoApp/randomJsInAuraFolder.js');
    expect(await context.isLWCJavascript(document)).toBeFalsy();

    // lwc .js in utils
    document = readAsTextDocument(SFDX_ROOT + '/' + UTILS_ROOT + '/lwc/todo_util/todo_util.js');
    expect(await context.isLWCJavascript(document)).toBeTruthy();

    context = new WorkspaceContext(SFDX_MULTI_ROOT);

    // lwc .js
    document = readAsTextDocument(SFDX_MULTI_ROOT[0] + '/' + FORCE_APP_ROOT + '/lwc/hello_world/hello_world.js');
    expect(await context.isLWCJavascript(document)).toBeTruthy();

    // lwc .htm
    document = readAsTextDocument(SFDX_MULTI_ROOT[0] + '/' + FORCE_APP_ROOT + '/lwc/hello_world/hello_world.html');
    expect(await context.isLWCJavascript(document)).toBeFalsy();

    // aura cmps
    document = readAsTextDocument(SFDX_MULTI_ROOT[0] + '/' + FORCE_APP_ROOT + '/aura/helloWorldApp/helloWorldApp.app');
    expect(await context.isLWCJavascript(document)).toBeFalsy();

    // .js outside namespace roots
    document = readAsTextDocument(SFDX_MULTI_ROOT[0] + '/' + FORCE_APP_ROOT + '/aura/todoApp/randomJsInAuraFolder.js');
    expect(await context.isLWCJavascript(document)).toBeFalsy();

    // lwc .js in utils
    document = readAsTextDocument(SFDX_MULTI_ROOT[0] + '/' + UTILS_ROOT + '/lwc/todo_util/todo_util.js');
    expect(await context.isLWCJavascript(document)).toBeTruthy();

    // lwc .js
    document = readAsTextDocument(SFDX_MULTI_ROOT[1] + '/' + FORCE_APP_ROOT + '/lwc/hello_world/hello_world.js');
    expect(await context.isLWCJavascript(document)).toBeTruthy();

    // lwc .htm
    document = readAsTextDocument(SFDX_MULTI_ROOT[1] + '/' + FORCE_APP_ROOT + '/lwc/hello_world/hello_world.html');
    expect(await context.isLWCJavascript(document)).toBeFalsy();

    // aura cmps
    document = readAsTextDocument(SFDX_MULTI_ROOT[1] + '/' + FORCE_APP_ROOT + '/aura/helloWorldApp/helloWorldApp.app');
    expect(await context.isLWCJavascript(document)).toBeFalsy();

    // .js outside namespace roots
    document = readAsTextDocument(SFDX_MULTI_ROOT[1] + '/' + FORCE_APP_ROOT + '/aura/todoApp/randomJsInAuraFolder.js');
    expect(await context.isLWCJavascript(document)).toBeFalsy();

    // lwc .js in utils
    document = readAsTextDocument(SFDX_MULTI_ROOT[1] + '/' + UTILS_ROOT + '/lwc/todo_util/todo_util.js');
    expect(await context.isLWCJavascript(document)).toBeTruthy();
});

// add configureSfdxProject
it('configureSfdxProject()', async () => {
    const context = new WorkspaceContext(SFDX_ROOT);
    const jsconfigPathForceApp = SFDX_ROOT + '/' + FORCE_APP_ROOT + '/lwc/jsconfig.json';
    const jsconfigPathUtilsOrig = SFDX_ROOT + '/' + UTILS_ROOT + '/lwc/jsconfig-orig.json';
    const jsconfigPathUtils = SFDX_ROOT + '/' + UTILS_ROOT + '/lwc/jsconfig.json';
    const eslintrcPathForceApp = SFDX_ROOT + '/' + FORCE_APP_ROOT + '/lwc/.eslintrc.json';
    const eslintrcPathUtilsOrig = SFDX_ROOT + '/' + UTILS_ROOT + '/lwc/eslintrc-orig.json';
    const eslintrcPathUtils = SFDX_ROOT + '/' + UTILS_ROOT + '/lwc/.eslintrc.json';
    const sfdxTypingsPath = 'test-workspaces/sfdx-workspace/.sfdx/typings/lwc';
    const forceignorePath = 'test-workspaces/sfdx-workspace/.forceignore';
    const settingsPath = 'test-workspaces/sfdx-workspace/.vscode/settings.json';

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
    await context.configureProject();

    const sfdxProjectConfigs = await context.getSfdxProjectConfig();
    expect(sfdxProjectConfigs[0].sfdxPackageDirsPattern).toBe('{force-app,utils,registered-empty-folder}');

    // verify newly created jsconfig.json
    const jsconfigForceAppContent = fs.readFileSync(jsconfigPathForceApp, 'utf8');
    expect(jsconfigForceAppContent).toContain('    "compilerOptions": {'); // check formatting
    const jsconfigForceApp = JSON.parse(jsconfigForceAppContent);
    expect(jsconfigForceApp.compilerOptions.experimentalDecorators).toBe(true);
    expect(jsconfigForceApp.include[0]).toBe('**/*');
    expect(jsconfigForceApp.include[1]).toBe('../../../../.sfdx/typings/lwc/**/*.d.ts');
    expect(jsconfigForceApp.compilerOptions.baseUrl).toBeUndefined(); // baseUrl/paths set when indexing
    expect(jsconfigForceApp.typeAcquisition).toEqual({ include: ['jest'] });
    // verify updated jsconfig.json
    const jsconfigUtilsContent = fs.readFileSync(jsconfigPathUtils, 'utf8');
    expect(jsconfigUtilsContent).toContain('    "compilerOptions": {'); // check formatting
    const jsconfigUtils = JSON.parse(jsconfigUtilsContent);
    expect(jsconfigUtils.compilerOptions.target).toBe('es2017');
    expect(jsconfigUtils.compilerOptions.experimentalDecorators).toBe(true);
    expect(jsconfigUtils.include[0]).toBe('util/*.js');
    expect(jsconfigUtils.include[1]).toBe('**/*');
    expect(jsconfigUtils.include[2]).toBe('../../../.sfdx/typings/lwc/**/*.d.ts');
    expect(jsconfigForceApp.typeAcquisition).toEqual({ include: ['jest'] });

    // verify newly created .eslintrc.json
    const eslintrcForceAppContent = fs.readFileSync(eslintrcPathForceApp, 'utf8');
    expect(eslintrcForceAppContent).toContain('    "extends": "@salesforce/eslint-config-lwc/recommended"'); // check formatting
    const eslintrcForceApp = JSON.parse(eslintrcForceAppContent);
    expect(eslintrcForceApp.extends).toBe('@salesforce/eslint-config-lwc/recommended');
    // verify updated .eslintrc.json
    const eslintrcUtilsContent = fs.readFileSync(eslintrcPathUtils, 'utf8');
    expect(eslintrcUtilsContent).toContain('    "extends": "@salesforce/eslint-config-lwc/recommended"'); // check formatting
    const eslintrcUtils = JSON.parse(eslintrcUtilsContent);
    expect(eslintrcUtils.extends).toBe('@salesforce/eslint-config-lwc/recommended');
    expect(eslintrcUtils.rules.semi).toBe('error');

    // .forceignore
    const forceignoreContent = fs.readFileSync(forceignorePath, 'utf8');
    expect(forceignoreContent).toContain('**/jsconfig.json');
    expect(forceignoreContent).toContain('**/.eslintrc.json');

    // typings
    expect(join(sfdxTypingsPath, 'lds.d.ts')).toExist();
    expect(join(sfdxTypingsPath, 'engine.d.ts')).toExist();
    expect(join(sfdxTypingsPath, 'apex.d.ts')).toExist();
    const schemaContents = fs.readFileSync(join(sfdxTypingsPath, 'schema.d.ts'), 'utf8');
    expect(schemaContents).toContain('declare module "@salesforce/schema" {');
    const apexContents = fs.readFileSync(join(sfdxTypingsPath, 'apex.d.ts'), 'utf8');
    expect(apexContents).not.toContain('declare type');
});

it('configureCoreProject()', async () => {
    const context = new WorkspaceContext(CORE_PROJECT_ROOT);
    const jsconfigPath = CORE_PROJECT_ROOT + '/modules/jsconfig.json';
    const typingsPath = CORE_ALL_ROOT + '/.vscode/typings/lwc';
    const settingsPath = CORE_PROJECT_ROOT + '/.vscode/settings.json';

    // make sure no generated files are there from previous runs
    fs.removeSync(jsconfigPath);
    fs.removeSync(typingsPath);

    // configure and verify typings/jsconfig after configuration:
    await context.configureProject();

    verifyJsconfigCore(jsconfigPath);
    verifyTypingsCore();

    const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
    verifyCoreSettings(settings);
});

it('configureCoreMulti()', async () => {
    const context = new WorkspaceContext(CORE_MULTI_ROOT);

    const jsconfigPathForce = context.workspaceRoots[0] + '/modules/jsconfig.json';
    const jsconfigPathGlobal = context.workspaceRoots[1] + '/modules/jsconfig.json';
    const codeWorkspacePath = CORE_ALL_ROOT + '/core.code-workspace';
    const launchPath = CORE_ALL_ROOT + '/.vscode/launch.json';

    // make sure no generated files are there from previous runs
    fs.removeSync(jsconfigPathGlobal);
    fs.removeSync(jsconfigPathForce);
    fs.removeSync(codeWorkspacePath);
    fs.removeSync(launchPath);

    // configure and verify typings/jsconfig after configuration:
    await context.configureProject();

    // verify newly created jsconfig.json
    verifyJsconfigCore(jsconfigPathGlobal);
    verifyJsconfigCore(jsconfigPathForce);
    verifyTypingsCore();
});

it('configureCoreAll()', async () => {
    const context = new WorkspaceContext(CORE_ALL_ROOT);
    const jsconfigPathGlobal = CORE_ALL_ROOT + '/ui-global-components/modules/jsconfig.json';
    const jsconfigPathForce = CORE_ALL_ROOT + '/ui-force-components/modules/jsconfig.json';
    const codeWorkspacePath = CORE_ALL_ROOT + '/core.code-workspace';
    const launchPath = CORE_ALL_ROOT + '/.vscode/launch.json';

    // make sure no generated files are there from previous runs
    fs.removeSync(jsconfigPathGlobal);
    fs.removeSync(jsconfigPathForce);
    fs.removeSync(codeWorkspacePath);
    fs.removeSync(launchPath);

    // configure and verify typings/jsconfig after configuration:
    await context.configureProject();

    // verify newly created jsconfig.json
    verifyJsconfigCore(jsconfigPathGlobal);
    verifyJsconfigCore(jsconfigPathForce);
    verifyTypingsCore();

    // Commenting out core-workspace & launch.json tests until we finalize
    // where these should live or if they should exist at all

    // verifyCodeWorkspace(codeWorkspacePath);

    // launch.json
    // const launchContent = fs.readFileSync(launchPath, 'utf8');
    // expect(launchContent).toContain('"name": "SFDC (attach)"');
});

function verifyJsconfigCore(jsconfigPath: string) {
    const jsconfigContent = fs.readFileSync(jsconfigPath, 'utf8');
    expect(jsconfigContent).toContain('    "compilerOptions": {'); // check formatting
    const jsconfig = JSON.parse(jsconfigContent);
    expect(jsconfig.compilerOptions.experimentalDecorators).toBe(true);
    expect(jsconfig.include[0]).toBe('**/*');
    expect(jsconfig.include[1]).toBe('../../.vscode/typings/lwc/**/*.d.ts');
    expect(jsconfig.typeAcquisition).toEqual({ include: ['jest'] });
    fs.removeSync(jsconfigPath);
}

function verifyTypingsCore() {
    const typingsPath = CORE_ALL_ROOT + '/.vscode/typings/lwc';
    expect(typingsPath + '/engine.d.ts').toExist();
    expect(typingsPath + '/lds.d.ts').toExist();
    fs.removeSync(typingsPath);
}

function verifyCodeWorkspace(path: string) {
    const content = fs.readFileSync(path, 'utf8');
    const workspace = JSON.parse(content);
    const folders = workspace.folders;
    expect(folders.length).toBe(1);
    const folderPath = folders[0].path;
    expect(folderPath).toBeAbsolutePath();
    expect(folderPath).toEndWith(utils.unixify(CORE_ALL_ROOT));
    const settings = workspace.settings;
    expect(settings['java.home']).toBe('path_to_java_home');
    expect(settings['extensions.ignoreRecommendations']).toBeTruthy();
    verifyCoreSettings(settings);
}

function verifyCoreSettings(settings: any) {
    expect(settings['files.watcherExclude']).toBeDefined();
    expect(settings['eslint.nodePath']).toBeDefined();
    expect(settings['perforce.client']).toBe('username-localhost-blt');
    expect(settings['perforce.user']).toBe('username');
    expect(settings['perforce.port']).toBe('ssl:host:port');
}
