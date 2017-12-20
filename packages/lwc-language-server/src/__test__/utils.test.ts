import * as utils from '../utils';
import * as tmp from 'tmp';
import * as fs from 'fs';
import { resolve } from 'path';
import { TextDocument } from 'vscode-languageserver';

it('getExtension()', () => {
    const jsDocument = TextDocument.create('file:///hello_world.js', 'javascript', 0, '');
    expect(utils.getExtension(jsDocument)).toBe('.js');
});

it('test canonicalizing in nodejs', () => {
    const canonical = resolve('tmp/./a/b/..');
    expect(canonical.endsWith('/tmp/a')).toBe(true);
});

it ('appendLineIfMissing()', () => {
    const file = tmp.tmpNameSync();
    tmp.setGracefulCleanup();

    // creates with line if file doesn't exist
    expect(file).not.fileToExist();
    utils.appendLineIfMissing(file, 'line 1');
    expect(fs.readFileSync(file).toString()).toBe('line 1\n');

    // add second line
    utils.appendLineIfMissing(file, 'line 2');
    expect(fs.readFileSync(file).toString()).toBe('line 1\n\nline 2\n');

    // doesn't add line if already there
    utils.appendLineIfMissing(file, 'line 1');
    expect(fs.readFileSync(file).toString()).toBe('line 1\n\nline 2\n');
});
