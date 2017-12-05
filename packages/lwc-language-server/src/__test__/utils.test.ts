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
