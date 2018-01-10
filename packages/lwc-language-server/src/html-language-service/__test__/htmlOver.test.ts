import {TextDocument} from 'vscode-languageserver-types';
import { getLanguageService } from '../htmlLanguageService';
import { WorkspaceContext } from '../../context';
import { loadStandardComponents, indexCustomComponents } from '../../metadata-utils/custom-components-util';
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
        expect(hover).not.toBeNull();
        const contents: any = hover.contents;
        expect(contents[0].value).toEqual(expectedHoverValue);
        if (expectedHoverLabel) {
            expect(contents[1]).toContain(expectedHoverLabel);
        }
        if (expectedHoverOffset) {
            expect(document.offsetAt(hover.range.start)).toBe(expectedHoverOffset);
        }
    } else {
        expect(hover).toBeNull();
    }
}

it('UC: hover is shown for standard and custom tags/attributes', async () => {
    const context = new WorkspaceContext('test-workspaces/sfdx-workspace');

    // standard tags
    await loadStandardComponents();

    assertHover('|<lightning-button></lightning-button>', undefined);
    assertHover('<lightning-bu|tton></lightning-button>', '<lightning-button>', 'Represents a button element\\.');
    assertHover('<lightning-button icon-n|ame="the-icon-name"></lightning-button>', 'icon-name', 'The Lightning Design System name of the icon\\.');
    assertHover('<lightning-button cl|ass="one"></lightning-button>', 'class', 'A CSS class for the outer element, in addition to ');
    assertHover('<lightning-button if:tr|ue={e}></lightning-button>', 'if:true', 'Renders the element or template if the expression value is thruthy');
    assertHover('<template if:tr|ue={e}></template>', 'if:true', 'Renders the element or template if the expression value is thruthy');
    assertHover('<ht|ml></html>', undefined);

    // custom tags
    await indexCustomComponents(context);
    assertHover('|<c-todo_item></c-todo_item>', undefined);
    assertHover('<|c-todo_item></c-todo_item>', '<c-todo_item>', 'TodoItem doc', 1);
    assertHover('<c-todo_it|em></c-todo_item>', '<c-todo_item>', 'TodoItem doc', 1);

    // custom tags from utils package
    assertHover('|<c-todo_util></c-todo_util>', undefined);
    assertHover('<|c-todo_util></c-todo_util>', '<c-todo_util>', 'LWC tag', 1);
    assertHover('<c-todo_ut|il></c-todo_util>', '<c-todo_util>', 'LWC tag', 1);
});
