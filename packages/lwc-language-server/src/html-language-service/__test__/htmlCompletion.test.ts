import { TextDocument, Position, CompletionItem, TextEdit } from 'vscode-languageserver';
import { getLanguageService } from '../htmlLanguageService';
import { loadStandardComponents, indexCustomComponents } from '../../metadata-utils/custom-components-util';
import { WorkspaceContext } from '../../context';
import { WorkspaceType } from '../../shared';

interface ICompletionMatcher {
    label: string;
    result: string;
    documentation?: string;
}

function applyEdit(document: TextDocument, edit: TextEdit): string {
    let text = document.getText();
    const startOffset = document.offsetAt(edit.range.start);
    const endOffset = document.offsetAt(edit.range.end);
    text = text.substring(0, startOffset) + edit.newText + text.substring(endOffset, text.length);
    return text;
}

function testCompletion(content: string, matchers: ICompletionMatcher[] = []) {
    const [before, after] = content.split('|');
    const document = TextDocument.create('test://test.html', 'html', 0, before + after);
    const position = Position.create(0, before.length);
    const ls = getLanguageService();
    const htmlDocument = ls.parseHTMLDocument(document);
    const items = ls.doComplete(document, position, htmlDocument);

    matchers.forEach(matcher => {
        const item = items.items.find(candidate => matcher.label === candidate.label);
        expect(item).toBeDefined();
        if (matcher.documentation) {
            expect(item.documentation).toContain(matcher.documentation);
        }
        expect(applyEdit(document, item.textEdit)).toEqual(matcher.result);
    });

    return items.items;
}

let res: CompletionItem[];

it('complete', async () => {
    res = testCompletion('<template>|</template>');
    expect(res).toHaveLength(1);

    res = testCompletion('<template |');
    expect(res).toHaveLength(5);

    testCompletion('<template><div |', [
        { label: 'if:true', result: '<template><div if:true=$1', documentation: 'Renders the element or template if the expression value is thruthy.' },
        { label: 'for:item', result: '<template><div for:item=$1' },
    ]);

    testCompletion('<template><div if|', [
        { label: 'if:true', result: '<template><div if:true=$1' },
        { label: 'if:false', result: '<template><div if:false=$1' },
    ]);

    testCompletion('<template><div i|f', [
        { label: 'if:true', result: '<template><div if:true=$1' },
        { label: 'if:false', result: '<template><div if:false=$1' },
    ]);

    testCompletion('<template><div if:|true={isTrue}', [{ label: 'if:true', result: '<template><div if:true={isTrue}' }]);

    const context = new WorkspaceContext('test-workspaces/sfdx-workspace');
    await loadStandardComponents();
    await indexCustomComponents(context);
    expect(context.type).toBe(WorkspaceType.SFDX);
    res = testCompletion('<template><lightning-');
    expect(res.length).toBeGreaterThan(10);

    testCompletion('<template><lightning-button-icon-stateful a', [
        {
            label: 'alternative-text',
            result: '<template><lightning-button-icon-stateful alternative-text=$1',
            documentation: 'The alternative text used to describe the icon.',
        },
    ]);

    testCompletion('<template><c-todo_item tod|', [{ label: 'todo', result: '<template><c-todo_item todo=$1' }]);
    testCompletion('<template><c-todo_util inf|', [{ label: 'info', result: '<template><c-todo_util info=$1' }]);
    testCompletion('<template><c-todo_util ico|', [{ label: 'icon-name', result: '<template><c-todo_util icon-name=$1' }]);
    testCompletion('<template><c-todo_util upp|', [{ label: 'upper-c-a-s-e', result: '<template><c-todo_util upper-c-a-s-e=$1' }]);
});
