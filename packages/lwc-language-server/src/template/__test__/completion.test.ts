import { TextDocument, Position } from 'vscode-languageserver';
import templateCompletion from '../completion';

function createAutocomplite(content: string) {
    const [before, after] = content.split('|');

    return {
        document: TextDocument.create(
            'test://test.html',
            'html',
            0,
            before + after,
        ),
        position: Position.create(0, before.length),
    };
}

it('in a tag body', () => {
    const { document, position } = createAutocomplite(
        '<template> | </template>',
    );
    const items = templateCompletion(document, position);
    expect(items).toHaveLength(0);
});

it('in a element start tag', () => {
    const { document, position } = createAutocomplite('<template><div | ');
    const items = templateCompletion(document, position);
    expect(items).toHaveLength(3);
});
