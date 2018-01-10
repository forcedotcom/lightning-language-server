import {TextDocument, Location} from 'vscode-languageserver-types';
import { getLanguageService } from '../htmlLanguageService';
import { WorkspaceContext } from '../../context';
import { loadStandardComponents, indexCustomComponents } from '../../metadata-utils/custom-components-util';

function assertDefinition(value: string, expectedUri: string | undefined): void {
    const offset = value.indexOf('|');
    value = value.substr(0, offset) + value.substr(offset + 1);

    const document = TextDocument.create('test://test/test.html', 'html', 0, value);

    const position = document.positionAt(offset);
    const ls = getLanguageService();
    const htmlDoc = ls.parseHTMLDocument(document);

    const location: Location = ls.findDefinition(document, position, htmlDoc);

    if (expectedUri) {
        expect(location.uri).toEndWith(expectedUri);
    } else {
        expect(location).toBeNull();
    }
}

it('UC: goto definition for custom tags', async () => {
    const context = new WorkspaceContext('test-workspaces/sfdx-workspace');

    // standard tags
    await loadStandardComponents();
    assertDefinition('|<lightning-button></lightning-button>', undefined);
    assertDefinition('<lightning-bu|tton></lightning-button>', undefined);
    assertDefinition('<lightning-button cl|ass="one"></lightning-button>', undefined);
    assertDefinition('<ht|ml></html>', undefined);

    // custom tags
    await indexCustomComponents(context);
    assertDefinition('|<c-todo_item></c-todo_item>', undefined);
    assertDefinition('<|c-todo_item></c-todo_item>', '/test-workspaces/sfdx-workspace/force-app/main/default/lightningcomponents/todo_item/todo_item.js');
    assertDefinition('<c-todo_it|em></c-todo_item>', '/test-workspaces/sfdx-workspace/force-app/main/default/lightningcomponents/todo_item/todo_item.js');

    // custom tags from utils package
    assertDefinition('|<c-todo_util></c-todo_util>', undefined);
    assertDefinition('<|c-todo_util></c-todo_util>', '/test-workspaces/sfdx-workspace/utils/meta/lightningcomponents/todo_util/todo_util.js');
    assertDefinition('<c-todo_ut|il></c-todo_util>', '/test-workspaces/sfdx-workspace/utils/meta/lightningcomponents/todo_util/todo_util.js');
});
