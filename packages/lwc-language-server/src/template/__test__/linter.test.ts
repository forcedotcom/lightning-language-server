import { TextDocument } from 'vscode-languageserver';
import templateLinter from '../linter';

it('returns a list of all the template compilation errors', () => {
    const content = `<template><template if:true="invalidExpression">{Math.random()}</template></template>`;
    const document = TextDocument.create(
        'test://test.html',
        'html',
        0,
        content,
    );

    const diagnostics = templateLinter(document);
    expect(diagnostics).toHaveLength(2);
    expect(diagnostics[0].message).toMatch(
        /If directive should be an expression/,
    );
    expect(diagnostics[0].range).toMatchObject({
        start: { character: 20 },
        end: { character: 47 },
    });
    expect(diagnostics[1].message).toMatch(/Invalid expression/);
    expect(diagnostics[1].range).toMatchObject({
        start: { character: 48 },
        end: { character: 63 },
    });
});
