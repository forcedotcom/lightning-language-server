import {TextDocument} from 'vscode-languageserver-types';
import { getLanguageService } from '../htmlLanguageService';
import { WorkspaceContext } from '../../context';
import { loadStandardLwc, indexCustomComponents } from '../../metadata-utils/custom-components-util';
import { Hover } from 'vscode-languageserver';

function assertHover(value: string, expectedHoverValue: string | undefined, expectedHoverLabel?: string, expectedHoverOffset?: number): void {
    const offset = value.indexOf('|');
    value = value.substr(0, offset) + value.substr(offset + 1);

    const document = TextDocument.create('test://test/test.html', 'html', 0, value);

    const position = document.positionAt(offset);
    const ls = getLanguageService();
    const htmlDoc = ls.parseHTMLDocument(document);

    const hover: Hover = ls.doHover(document, position, htmlDoc);

    if (expectedHoverValue) {
        const contents: any = hover.contents;
        expect(contents[0].value).toEqual(expectedHoverValue);
        if (expectedHoverLabel) {
            expect(contents[1]).toBe('[doc placeholder]');
        }
        if (expectedHoverOffset) {
            expect(document.offsetAt(hover.range.start)).toBe(expectedHoverOffset);
        }
    } else {
        expect(hover).toBeNull();
    }
}

it('UC: hover is shown for standard and custom tags', async () => {
    const context = WorkspaceContext.createFrom('test-workspaces/sfdx-workspace');

    // standard tags
    await loadStandardLwc();
    assertHover('|<lightning-button></lightning-button>', undefined);
    assertHover('<lightning-bu|tton></lightning-button>', '<lightning-button>', undefined, 1);
    assertHover('<lightning-button cl|ass="one"></lightning-button>', undefined);
    assertHover('<ht|ml></html>', undefined);

    // custom tags
    await indexCustomComponents(context);
    assertHover('|<c-todo_item></c-todo_item>', undefined);
    assertHover('<|c-todo_item></c-todo_item>', '<c-todo_item>', undefined, 1);
    assertHover('<c-todo_it|em></c-todo_item>', '<c-todo_item>', undefined, 1);
});
