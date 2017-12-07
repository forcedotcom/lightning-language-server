import * as utils from '../utils';
import { resolve } from 'path';
import { TextDocument } from 'vscode-languageserver';

it('utils.getExtension()', () => {
    const jsDocument = TextDocument.create('file:///hello_world.js', 'javascript', 0, '');
    expect(utils.getExtension(jsDocument)).toBe('.js');
});

it('test canonicalizing in nodejs', () => {
    const canonical = resolve('tmp/./a/b/..');
    expect(canonical.endsWith('/tmp/a')).toBe(true);
});
