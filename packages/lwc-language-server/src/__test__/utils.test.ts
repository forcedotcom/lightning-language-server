import * as utils from '../utils';
import { TextDocument } from 'vscode-languageserver';

it('utils.isTemplate()', () => {
    const jsDocument = TextDocument.create('file:///hello_world.js', 'javascript', 0, '');
    expect(utils.isTemplate(jsDocument)).toBeFalsy();

    const lwcContent = `
        <template>
            Hello From a Lightning Web Component!
        </template>
    `;
    const lwcDocument = TextDocument.create('file:///hello_world.html', 'html', 0, lwcContent);
    expect(utils.isTemplate(lwcDocument)).toBeTruthy();

    const auraContent = `
        <aura:application>
        <c:hello_world />
        <br/>
        <c:import_relative></c:import_relative>
        </aura:application>
    `;
    // sfdx assigns the 'html' language id to aura components
    const auraDocument = TextDocument.create('file:///helloWorldApp.app', 'html', 0, auraContent);
    expect(utils.isTemplate(auraDocument)).toBeFalsy();
});

it('utils.findNamespaceRoots()/findModules()', () => {
    let roots = utils.findNamespaceRoots('test-workspaces/test-force-app-metadata');
    expect(roots).toEqual(['test-workspaces/test-force-app-metadata/lightningcomponents']);
    let modules = utils.findModules(roots);
    expect(modules).toContain('test-workspaces/test-force-app-metadata/lightningcomponents/hello_world/hello_world.js');
    expect(modules).toContain('test-workspaces/test-force-app-metadata/lightningcomponents/wire_lds/wire_lds.js');
    expect(modules.length).toBe(10);

    roots = utils.findNamespaceRoots('test-workspaces/regular-workspace');
    expect(roots).toEqual(['test-workspaces/regular-workspace/src/modules/example',
        'test-workspaces/regular-workspace/src/modules/other']);
    modules = utils.findModules(roots);
    expect(modules).toEqual(['test-workspaces/regular-workspace/src/modules/example/app/app.js'
        , 'test-workspaces/regular-workspace/src/modules/example/line/line.js'
        , 'test-workspaces/regular-workspace/src/modules/other/text/text.js']);

    roots = utils.findNamespaceRoots('test-workspaces/core-like-workspace');
    expect(roots).toEqual(['test-workspaces/core-like-workspace/core/ui-force-components/modules/force',
        'test-workspaces/core-like-workspace/core/ui-global-components/modules/one']);
    modules = utils.findModules(roots);
    expect(modules).toEqual([
        'test-workspaces/core-like-workspace/core/ui-force-components/modules/force/input-phone/input-phone.js',
        'test-workspaces/core-like-workspace/core/ui-global-components/modules/one/app-nav-bar/app-nav-bar.js']);

    // console.log('core roots:', utils.findNamespaceRoots('/Users/rsalvador/blt/app/main/core'));
});
