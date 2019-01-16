import { utils } from 'lightning-lsp-common';
import * as tmp from 'tmp';
import { join, resolve } from 'path';
import { TextDocument, FileEvent, FileChangeType } from 'vscode-languageserver';

it('includesWatchedDirectory', () => {
    const directoryDeletedEvent: FileEvent = {
        type: FileChangeType.Deleted,
        uri: 'file:///Users/user/test/dir',
    };
    const jsFileDeletedEvent: FileEvent = {
        type: FileChangeType.Deleted,
        uri: 'file:///Users/user/test/dir/file.js',
    };
    const htmlFileDeletedEvent: FileEvent = {
        type: FileChangeType.Deleted,
        uri: 'file:///Users/user/test/dir/file.html',
    };
    expect(utils.includesWatchedDirectory([jsFileDeletedEvent, directoryDeletedEvent])).toBeTruthy();
    expect(utils.includesWatchedDirectory([jsFileDeletedEvent])).toBeFalsy();
    expect(utils.includesWatchedDirectory([htmlFileDeletedEvent])).toBeFalsy();
});

it('isLWCRootDirectoryChange', () => {
    const noLwcFolderCreated: FileEvent = {
        type: FileChangeType.Created,
        uri: 'file:///Users/user/test/dir',
    };
    const noLwcFolderDeleted: FileEvent = {
        type: FileChangeType.Deleted,
        uri: 'file:///Users/user/test/dir',
    };
    const lwcFolderCreated: FileEvent = {
        type: FileChangeType.Created,
        uri: 'file:///Users/user/test/dir/lwc',
    };
    const lwcFolderDeleted: FileEvent = {
        type: FileChangeType.Deleted,
        uri: 'file:///Users/user/test/dir/lwc',
    };
    expect(utils.isLWCRootDirectoryChange([noLwcFolderCreated, noLwcFolderDeleted])).toBeFalsy();
    expect(utils.isLWCRootDirectoryChange([noLwcFolderCreated])).toBeFalsy();
    expect(utils.isLWCRootDirectoryChange([noLwcFolderCreated, lwcFolderCreated])).toBeTruthy();
    expect(utils.isLWCRootDirectoryChange([lwcFolderCreated, lwcFolderDeleted])).toBeTruthy();
});

it('getExtension()', () => {
    const jsDocument = TextDocument.create('file:///hello_world.js', 'javascript', 0, '');
    expect(utils.getExtension(jsDocument)).toBe('.js');
});

it('test canonicalizing in nodejs', () => {
    const canonical = resolve(join('tmp', '.', 'a', 'b', '..'));
    expect(canonical.endsWith(join('tmp', 'a'))).toBe(true);
});

it('appendLineIfMissing()', () => {
    const file = tmp.tmpNameSync();
    tmp.setGracefulCleanup();

    // creates with line if file doesn't exist
    expect(file).not.toExist();
    utils.appendLineIfMissing(file, 'line 1');
    expect(utils.readFileSync(file)).toBe('line 1\n');

    // add second line
    utils.appendLineIfMissing(file, 'line 2');
    expect(utils.readFileSync(file)).toBe('line 1\n\nline 2\n');

    // doesn't add line if already there
    utils.appendLineIfMissing(file, 'line 1');
    expect(utils.readFileSync(file)).toBe('line 1\n\nline 2\n');
});

it('deepMerge()', () => {
    // simplest
    let to: any = { a: 1 };
    let from: any = { b: 2 };
    expect(utils.deepMerge(to, from)).toBeTruthy();
    expect(to).toEqual({ a: 1, b: 2 });
    expect(utils.deepMerge({ a: 1 }, { a: 1 })).toBeFalsy();

    // do not overwrite scalar
    to = { a: 1 };
    from = { a: 2 };
    expect(utils.deepMerge(to, from)).toBeFalsy();
    expect(to).toEqual({ a: 1 });

    // nested object gets copied
    to = { a: 1 };
    from = { o: { n: 1 } };
    expect(utils.deepMerge(to, from)).toBeTruthy();
    expect(to).toEqual({ a: 1, o: { n: 1 } });
    expect(utils.deepMerge({ o: { n: 1 } }, { o: { n: 1 } })).toBeFalsy();

    // nested object gets merged if in both
    to = { a: 1, o: { x: 2 } };
    from = { o: { n: 1 } };
    expect(utils.deepMerge(to, from)).toBeTruthy();
    expect(to).toEqual({ a: 1, o: { x: 2, n: 1 } });

    // array elements get merged
    to = { a: [1, 2] };
    from = { a: [3, 4] };
    expect(utils.deepMerge(to, from)).toBeTruthy();
    expect(to).toEqual({ a: [1, 2, 3, 4] });
    expect(utils.deepMerge({ a: [1, 2] }, { a: [1, 2] })).toBeFalsy();

    // if from has array but to has scalar then also results in array
    to = { a: 0 };
    from = { a: [3, 4] };
    expect(utils.deepMerge(to, from)).toBeTruthy();
    expect(to).toEqual({ a: [0, 3, 4] });

    // if to has array but from has scalar then also results in array
    to = { a: [1, 2] };
    from = { a: 3 };
    expect(utils.deepMerge(to, from)).toBeTruthy();
    expect(to).toEqual({ a: [1, 2, 3] });

    // object array elements
    to = { a: [{ x: 1 }] };
    from = { a: [{ y: 2 }] };
    expect(utils.deepMerge(to, from)).toBeTruthy();
    expect(to).toEqual({ a: [{ x: 1 }, { y: 2 }] });
    expect(utils.deepMerge({ a: [{ y: 2 }] }, { a: [{ y: 2 }] })).toBeFalsy();

    // don't add scalar to array if already in array
    to = { a: [1, 2] };
    from = { a: 2 };
    expect(utils.deepMerge(to, from)).toBeFalsy();
    expect(to).toEqual({ a: [1, 2] });
    to = { a: 2 };
    from = { a: [1, 2] };
    expect(utils.deepMerge(to, from)).toBeTruthy();
    expect(to).toEqual({ a: [2, 1] });
});
