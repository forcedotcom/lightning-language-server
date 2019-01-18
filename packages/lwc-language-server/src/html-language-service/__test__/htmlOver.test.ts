import { TextDocument } from 'vscode-languageserver-types';
import { getLanguageService } from '../htmlLanguageService';
import { WorkspaceContext } from 'lightning-lsp-common';
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

function assertNoHover(src: string): void {
    const retval = doHover(src);
    expect(retval.hover).toBeNull();
}

function assertHover(src: string, expectedMarkdownValue?: string, expectedHoverOffset?: number): void {
    const { document, hover } = doHover(src);
    const contents: any = hover.contents;
    expect(contents.kind).toBe('markdown');
    expect(contents.value).toContain(expectedMarkdownValue);
    if (expectedHoverOffset) {
        expect(document.offsetAt(hover.range.start)).toBe(expectedHoverOffset);
    }
}

it('UC: hover is shown for standard and custom tags/attributes', async () => {
    const context = new WorkspaceContext('test-workspaces/sfdx-workspace');

    // standard tags
    await loadStandardComponents();

    assertNoHover('|<lightning-button></lightning-button>');
    assertHover(
        '<lightning-bu|tton></lightning-button>',
        '```html\n<lightning-button>\n```\nRepresents a button element.\n\n\nhttps://developer.salesforce.com/docs/component-library/bundle/lightning-button',
    );
    assertHover('<lightning-button icon-n|ame="the-icon-name"></lightning-button>', '**icon-name**\n\nThe Lightning Design System name of the icon');
    assertHover('<lightning-button cl|ass="one"></lightning-button>', '**class**\n\nA CSS class for the outer element, in addition to ');
    assertHover('<lightning-button if:tr|ue={e}></lightning-button>', '**if:true**\n\nRenders the element or template if the expression value is thruthy');
    assertHover('<template if:tr|ue={e}></template>', '**if:true**\n\nRenders the element or template if the expression value is thruthy');
    assertNoHover('<ht|ml></html>');
    // standard component with multiple -
    assertHover(
        '<lightning-formatted-num|ber></lightning-formatted-number>',
        '```html\n<lightning-formatted-number>\n```\nDisplays formatted numbers for decimals, currency, and percentages.\n\n\n' +
            'https://developer.salesforce.com/docs/component-library/bundle/lightning-formatted-number',
    );

    // custom tags
    await indexCustomComponents(context);
    assertNoHover('|<c-todo_item></c-todo_item>');
    assertHover('<|c-todo_item></c-todo_item>', '```html\n<c-todo_item>\n```\nTodoItem doc', 1);
    assertHover('<c-todo_it|em></c-todo_item>', '```html\n<c-todo_item>\n```\nTodoItem doc', 1);
    // custom attributes
    assertHover('<c-todo_item to|do></c-todo_item>', '**todo**\n\ntodo jsdoc', 13);

    // custom tags from utils package
    assertNoHover('|<c-todo_util></c-todo_util>');
    assertHover('<c-todo_ut|il></c-todo_util>', '```html\n<c-todo_util>\n```\nLWC element');
});
