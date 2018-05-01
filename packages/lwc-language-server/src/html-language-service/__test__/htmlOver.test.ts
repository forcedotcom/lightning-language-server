import { TextDocument } from 'vscode-languageserver-types';
import { getLanguageService } from '../htmlLanguageService';
import { WorkspaceContext } from '../../context';
import { loadStandardComponents, indexCustomComponents } from '../../metadata-utils/custom-components-util';
import { Hover } from 'vscode-languageserver';

function doHover(src: string) {
    const offset = src.indexOf('|');
    src = src.substr(0, offset) + src.substr(offset + 1);

    const document = TextDocument.create('test://test/test.html', 'html', 0, src);

    const position = document.positionAt(offset);
    const ls = getLanguageService();
    const htmlDoc = ls.parseHTMLDocument(document);
    const hover: Hover = ls.doHover(document, position, htmlDoc);

    return { document, hover };
}

function assertHover(src: string, expectedHoverValue?: string, expectedHoverLabel?: string, expectedHoverOffset?: number): void {
    const { document, hover } = doHover(src);
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

function assertHoverMarkdown(src: string, expectedMarkdownValue?: string, expectedHoverOffset?: number): void {
    const { document, hover } = doHover(src);
    const contents: any = hover.contents;
    expect(contents.kind).toBe('markdown');
    expect(contents.value).toBe(expectedMarkdownValue);
    if (expectedHoverOffset) {
        expect(document.offsetAt(hover.range.start)).toBe(expectedHoverOffset);
    }
}

it('UC: hover is shown for standard and custom tags/attributes', async () => {
    const context = new WorkspaceContext('test-workspaces/sfdx-workspace');

    // standard tags
    await loadStandardComponents();

    assertHover('|<lightning-button></lightning-button>');
    assertHoverMarkdown(
        '<lightning-bu|tton></lightning-button>',
        '```html\n<lightning-button>\n```\nRepresents a button element.\n\n\nhttps://developer.salesforce.com/docs/component-library?page=lightning:button',
    );
    assertHover('<lightning-button icon-n|ame="the-icon-name"></lightning-button>', 'icon-name', 'The Lightning Design System name of the icon\\.');
    assertHover('<lightning-button cl|ass="one"></lightning-button>', 'class', 'A CSS class for the outer element, in addition to ');
    assertHover('<lightning-button if:tr|ue={e}></lightning-button>', 'if:true', 'Renders the element or template if the expression value is thruthy');
    assertHover('<template if:tr|ue={e}></template>', 'if:true', 'Renders the element or template if the expression value is thruthy');
    assertHover('<ht|ml></html>');

    // custom tags
    await indexCustomComponents(context);
    assertHover('|<c-todo_item></c-todo_item>');
    assertHoverMarkdown('<|c-todo_item></c-todo_item>', '```html\n<c-todo_item>\n```\nTodoItem doc', 1);
    assertHoverMarkdown('<c-todo_it|em></c-todo_item>', '```html\n<c-todo_item>\n```\nTodoItem doc', 1);
    // custom attributes
    assertHover('<c-todo_item to|do></c-todo_item>', 'todo', 'todo jsdoc', 13);

    // custom tags from utils package
    assertHover('|<c-todo_util></c-todo_util>');
    assertHoverMarkdown('<c-todo_ut|il></c-todo_util>', '```html\n<c-todo_util>\n```\nLWC element');
});
