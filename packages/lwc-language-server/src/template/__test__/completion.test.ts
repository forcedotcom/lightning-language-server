import {
    TextDocument,
    Position,
    CompletionItem,
    TextEdit,
} from 'vscode-languageserver';
import templateCompletion from '../completion';

interface ICompletionMatcher {
    label: string;
    result: string;
}

function applyEdit(document: TextDocument, edit: TextEdit): string {
    let text = document.getText();
    const startOffset = document.offsetAt(edit.range.start);
    const endOffset = document.offsetAt(edit.range.end);
    text =
        text.substring(0, startOffset) +
        edit.newText +
        text.substring(endOffset, text.length);
    return text;
}

function testCompletion(content: string, matchers: ICompletionMatcher[] = []) {
    const [before, after] = content.split('|');
    const document = TextDocument.create(
        'test://test.html',
        'html',
        0,
        before + after,
    );
    const position = Position.create(0, before.length);
    const items = templateCompletion(document, position);

    matchers.forEach(matcher => {
        const item = items.find(candidate => matcher.label === candidate.label);
        expect(item).toBeDefined();
        expect(applyEdit(document, item.textEdit)).toEqual(matcher.result);
    });

    return items;
}

let res: CompletionItem[];

it('complete', () => {
    res = testCompletion('<template>|</template>');
    expect(res).toHaveLength(0);

    res = testCompletion('<template |');
    expect(res).toHaveLength(0);

    testCompletion('<template><div |', [
        { label: 'if:true', result: '<template><div if:true={$1}' },
        { label: 'for:item', result: '<template><div for:item="$1"' },
    ]);

    testCompletion('<template><div if|', [
        { label: 'if:true', result: '<template><div if:true={$1}' },
        { label: 'if:false', result: '<template><div if:false={$1}' },
    ]);

    testCompletion('<template><div i|f', [
        { label: 'if:true', result: '<template><div if:true={$1}' },
        { label: 'if:false', result: '<template><div if:false={$1}' },
    ]);

    testCompletion('<template><div if:|true={isTrue}', [
        { label: 'if:true', result: '<template><div if:true={isTrue}' },
    ]);
});
