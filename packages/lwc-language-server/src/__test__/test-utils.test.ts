import { readAsTextDocument } from './test-utils';

it('readAsTextDocument()', () => {
    // reads .js file
    let document = readAsTextDocument('test-workspaces/test-force-app-metadata/lightningcomponents/hello_world/hello_world.js');
    expect(document.uri).toEndWith('/test-workspaces/test-force-app-metadata/lightningcomponents/hello_world/hello_world.js');
    expect(document.languageId).toBe('javascript');
    expect(document.getText()).toContain('LwcHelloWorld');

    // reads .html file
    document = readAsTextDocument('test-workspaces/test-force-app-metadata/lightningcomponents/hello_world/hello_world.html');
    expect(document.uri).toEndWith('/test-workspaces/test-force-app-metadata/lightningcomponents/hello_world/hello_world.html');
    expect(document.languageId).toBe('html');
    expect(document.getText()).toContain('Hello From a Lightning Web Component');

    // aura components have the html languageId in the sfdx extentions
    document = readAsTextDocument('test-workspaces/test-force-app-metadata/aura/helloWorldApp/helloWorldApp.app');
    expect(document.languageId).toBe('html');
    document = readAsTextDocument('test-workspaces/test-force-app-metadata/aura/wireLdsCmp/wireLdsCmp.cmp');
    expect(document.languageId).toBe('html');
});
