import { TextDocument } from 'vscode-languageserver';
import templateSymbolsProvider from '../symbols';

it('returns an empty list for leaf component', () => {
    const content = `<template><div>header</div><p>paragraph</p></template>`;
    const document = TextDocument.create('test://test.html', 'html', 0, content);

    const symbols = templateSymbolsProvider(document);
    expect(symbols).toHaveLength(0);
});

it('returns a list containing raptor components', () => {
    const content = `<template><foo-bar></foo-bar><template if:true={true}><foo-baz></foo-baz></template></template>`;
    const document = TextDocument.create('test://test.html', 'html', 0, content);

    const symbols = templateSymbolsProvider(document);
    expect(symbols).toMatchObject([
        { name: 'foo-bar' },
        { name: 'foo-baz' },
    ]);
});
