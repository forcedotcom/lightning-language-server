import { TextDocument, Location, Range, Position } from 'vscode-languageserver-types';
import { getLanguageService } from '@salesforce/lightning-lsp-common';
import { loadStandardComponents, indexCustomComponents } from '../../metadata-utils/custom-components-util';
import { WorkspaceContext } from '@salesforce/lightning-lsp-common';
import { FORCE_APP_ROOT, UTILS_ROOT } from './test-utils';
import * as fs from 'fs-extra';
import { getLwcTagProvider } from '../../markup/lwcTags';

// Need for debugging
// jest.setTimeout(30000);

beforeEach(() => {
    const jsconfigPathForceApp = FORCE_APP_ROOT + '/lwc/jsconfig.json';
    const jsconfigPathUtilsOrig = UTILS_ROOT + '/lwc/jsconfig-orig.json';
    const jsconfigPathUtils = UTILS_ROOT + '/lwc/jsconfig.json';
    const sfdxTypingsPath = 'test-workspaces/sfdx-workspace/.sfdx/typings/lwc';
    const forceignorePath = 'test-workspaces/sfdx-workspace/.forceignore';

    // make sure no generated files are there from previous runs
    fs.removeSync(jsconfigPathForceApp);
    fs.copySync(jsconfigPathUtilsOrig, jsconfigPathUtils);
    fs.removeSync(forceignorePath);
    fs.removeSync(sfdxTypingsPath);
});

function assertDefinition(value: string, expectedUri?: string, expectedRange?: Range): void {
    const offset = value.indexOf('|');
    value = value.substr(0, offset) + value.substr(offset + 1);

    const document = TextDocument.create('test://test/test.html', 'html', 0, value);

    const position = document.positionAt(offset);
    const ls = getLanguageService();
    if (ls.getTagProviders().length === 0) {
        // Only add the tag provider once
        ls.addTagProvider(getLwcTagProvider());
    }
    const htmlDoc = ls.parseHTMLDocument(document);

    const location: Location = ls.findDefinition(document, position, htmlDoc);

    if (expectedUri) {
        expect(location.uri).toEndWith(expectedUri);
        if (expectedRange) {
            expect(location.range).toMatchObject(expectedRange);
        }
    } else {
        expect(location).toBeNull();
    }
}

it('UC: goto definition for custom tags and attributes', async () => {
    const context = new WorkspaceContext('test-workspaces/sfdx-workspace');

    // standard tags
    await loadStandardComponents(context);
    assertDefinition('|<lightning-button></lightning-button>');
    assertDefinition('<lightning-bu|tton></lightning-button>');
    assertDefinition('<lightning-button cl|ass="one"></lightning-button>');
    assertDefinition('<ht|ml></html>');

    // custom tags
    await indexCustomComponents(context);
    assertDefinition('|<c-todo_item></c-todo_item>');
    assertDefinition('<|c-todo_item></c-todo_item>', '/test-workspaces/sfdx-workspace/force-app/main/default/lwc/todo_item/todo_item.js');
    assertDefinition(
        '<c-todo_it|em></c-todo_item>',
        '/test-workspaces/sfdx-workspace/force-app/main/default/lwc/todo_item/todo_item.js',
        Range.create(Position.create(6, 0), Position.create(90, 1)),
    );

    // custom attributes
    assertDefinition('<c-todo_item |></c-todo_item>');
    assertDefinition(
        '<c-todo_item to|do></c-todo_item>',
        '/test-workspaces/sfdx-workspace/force-app/main/default/lwc/todo_item/todo_item.js',
        Range.create(Position.create(14, 4), Position.create(17, 5)),
    );
    assertDefinition(
        '<c-todo_item sa|me-line></c-todo_item>',
        '/test-workspaces/sfdx-workspace/force-app/main/default/lwc/todo_item/todo_item.js',
        Range.create(Position.create(25, 4), Position.create(25, 18)),
    );
    assertDefinition(
        '<c-todo_item ne|xt-line></c-todo_item>',
        '/test-workspaces/sfdx-workspace/force-app/main/default/lwc/todo_item/todo_item.js',
        Range.create(Position.create(27, 4), Position.create(28, 13)),
    );

    // custom tags from utils package
    assertDefinition('|<c-todo_util></c-todo_util>');
    assertDefinition('<|c-todo_util></c-todo_util>', '/test-workspaces/sfdx-workspace/utils/meta/lwc/todo_util/todo_util.js');
    assertDefinition('<c-todo_ut|il></c-todo_util>', '/test-workspaces/sfdx-workspace/utils/meta/lwc/todo_util/todo_util.js');
});
