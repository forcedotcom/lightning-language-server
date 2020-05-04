import { TextDocument } from 'vscode-languageserver';
import templateLinter from '../linter';
import { compileDocument as javascriptCompileDocument } from '../../javascript/compiler';
import { quickfix } from '../code-actions';
import {
    MSG_QUICKFIX_LIGHTNING_TYPO,
    MSG_QUICKFIX_CONVERT_TO_EXPRESSION,
    MSG_QUICKFIX_CONVERT_TO_STRING,
    MSG_QUICKFIX_IF_TRUE,
    MSG_QUICKFIX_IF_FALSE,
    MSG_QUICKFIX_AMBIGUITY,
    MSG_QUICKFIX_INSERT_KEY,
    MSG_QUICKFIX_IMPORT_DECORATOR,
    MSG_QUICKFIX_FIX_INVALID_EXPRESSION,
} from '../constants';

const FILENAME = 'test://test.html';
const FILENAME_JS = 'file:///test.js';
it('returns a quickfix for the lighting- typo', () => {
    const content = `<template><lighting-card></lighting-card></template>`;
    const document = TextDocument.create(FILENAME, 'html', 0, content);
    const diagnostics = templateLinter(document);

    const quickfixResult = quickfix(document, { context: { diagnostics }, textDocument: null, range: diagnostics[0].range });

    expect(quickfixResult).toHaveLength(1);
    expect(quickfixResult[0].title).toEqual(MSG_QUICKFIX_LIGHTNING_TYPO);
    expect(quickfixResult[0].edit.changes[FILENAME][0].newText).toMatch(/<lightning-/);
    expect(quickfixResult[0].edit.changes[FILENAME][0].range).toMatchObject(diagnostics[0].range);
});

it('returns a list of quickfixes for converting string to expression with iterator:it', () => {
    const content = `<template><template iterator:it="someIterator"></template><template iterator:it=someIterator></template></template>`;
    const document = TextDocument.create(FILENAME, 'html', 0, content);
    const diagnostics = templateLinter(document);

    const quickfixResult = quickfix(document, { context: { diagnostics }, textDocument: null, range: diagnostics[0].range });

    expect(quickfixResult).toHaveLength(2);
    expect(quickfixResult[0].title).toEqual(MSG_QUICKFIX_CONVERT_TO_EXPRESSION);
    expect(quickfixResult[0].edit.changes[FILENAME][0].newText).toMatch(/iterator:it={someIterator}/);
    expect(quickfixResult[0].edit.changes[FILENAME][0].range).toMatchObject(diagnostics[0].range);
    expect(quickfixResult[1].title).toEqual(MSG_QUICKFIX_CONVERT_TO_EXPRESSION);
    expect(quickfixResult[1].edit.changes[FILENAME][0].newText).toMatch(/iterator:it={someIterator}/);
    expect(quickfixResult[1].edit.changes[FILENAME][0].range).toMatchObject(diagnostics[1].range);
});

it('returns a list of quickfixes for converting string to expression with for:each', () => {
    const content = `<template><template for:each="someProp" for:item="item"></template><template for:each=someProp for:item="item"></template></template>`;
    const document = TextDocument.create(FILENAME, 'html', 0, content);
    const diagnostics = templateLinter(document);

    const quickfixResult = quickfix(document, { context: { diagnostics }, textDocument: null, range: diagnostics[0].range });

    expect(quickfixResult).toHaveLength(2);
    expect(quickfixResult[0].title).toEqual(MSG_QUICKFIX_CONVERT_TO_EXPRESSION);
    expect(quickfixResult[0].edit.changes[FILENAME][0].newText).toMatch(/for:each={someProp}/);
    expect(quickfixResult[0].edit.changes[FILENAME][0].range).toMatchObject(diagnostics[0].range);
    expect(quickfixResult[1].title).toEqual(MSG_QUICKFIX_CONVERT_TO_EXPRESSION);
    expect(quickfixResult[1].edit.changes[FILENAME][0].newText).toMatch(/for:each={someProp}/);
    expect(quickfixResult[1].edit.changes[FILENAME][0].range).toMatchObject(diagnostics[1].range);
});

it('returns a list of quickfixes for converting string to expression with key', () => {
    const content = `<template><template for:each={someProp} for:item="item"><div key="someKey"></div></template><template for:each={someProp} for:item="item"><div key=someKey></div></template></template>`;
    const document = TextDocument.create(FILENAME, 'html', 0, content);
    const diagnostics = templateLinter(document);

    const quickfixResult = quickfix(document, { context: { diagnostics }, textDocument: null, range: diagnostics[0].range });

    expect(quickfixResult).toHaveLength(2);
    expect(quickfixResult[0].title).toEqual(MSG_QUICKFIX_CONVERT_TO_EXPRESSION);
    expect(quickfixResult[0].edit.changes[FILENAME][0].newText).toMatch(/key={someKey}/);
    expect(quickfixResult[0].edit.changes[FILENAME][0].range).toMatchObject(diagnostics[0].range);
    expect(quickfixResult[1].title).toEqual(MSG_QUICKFIX_CONVERT_TO_EXPRESSION);
    expect(quickfixResult[1].edit.changes[FILENAME][0].newText).toMatch(/key={someKey}/);
    expect(quickfixResult[1].edit.changes[FILENAME][0].range).toMatchObject(diagnostics[1].range);
});

it('returns a list of quickfixes for converting string to expression with if:true/if:false', () => {
    const content = `<template><template if:true="some"></template><template if:true=some></template><template if:false="some"></template><template if:false=some></template></template>`;
    const document = TextDocument.create(FILENAME, 'html', 0, content);
    const diagnostics = templateLinter(document);

    const quickfixResult = quickfix(document, { context: { diagnostics }, textDocument: null, range: diagnostics[0].range });

    expect(quickfixResult).toHaveLength(4);
    expect(quickfixResult[0].title).toEqual(MSG_QUICKFIX_CONVERT_TO_EXPRESSION);
    expect(quickfixResult[0].edit.changes[FILENAME][0].newText).toMatch(/if:true={some}/);
    expect(quickfixResult[0].edit.changes[FILENAME][0].range).toMatchObject(diagnostics[0].range);
    expect(quickfixResult[1].title).toEqual(MSG_QUICKFIX_CONVERT_TO_EXPRESSION);
    expect(quickfixResult[1].edit.changes[FILENAME][0].newText).toMatch(/if:true={some}/);
    expect(quickfixResult[1].edit.changes[FILENAME][0].range).toMatchObject(diagnostics[1].range);
    expect(quickfixResult[2].title).toEqual(MSG_QUICKFIX_CONVERT_TO_EXPRESSION);
    expect(quickfixResult[2].edit.changes[FILENAME][0].newText).toMatch(/if:false={some}/);
    expect(quickfixResult[2].edit.changes[FILENAME][0].range).toMatchObject(diagnostics[2].range);
    expect(quickfixResult[3].title).toEqual(MSG_QUICKFIX_CONVERT_TO_EXPRESSION);
    expect(quickfixResult[3].edit.changes[FILENAME][0].newText).toMatch(/if:false={some}/);
    expect(quickfixResult[3].edit.changes[FILENAME][0].range).toMatchObject(diagnostics[3].range);
});

it('returns a quickfix for converting expression to string with for:item', () => {
    const content = `<template><template for:each={someProp} for:item={item} for:index="idx"></template></template>`;
    const document = TextDocument.create(FILENAME, 'html', 0, content);
    const diagnostics = templateLinter(document);

    const quickfixResult = quickfix(document, { context: { diagnostics }, textDocument: null, range: diagnostics[0].range });

    expect(quickfixResult).toHaveLength(1);
    expect(quickfixResult[0].title).toEqual(MSG_QUICKFIX_CONVERT_TO_STRING);
    expect(quickfixResult[0].edit.changes[FILENAME][0].newText).toMatch(/for:item="item"/);
    expect(quickfixResult[0].edit.changes[FILENAME][0].range).toMatchObject(diagnostics[0].range);
});

it('returns a quickfix for converting expression to string with for:index', () => {
    const content = `<template><template for:each={someProp} for:item="item" for:index={idx}></template></template>`;
    const document = TextDocument.create(FILENAME, 'html', 0, content);
    const diagnostics = templateLinter(document);

    const quickfixResult = quickfix(document, { context: { diagnostics }, textDocument: null, range: diagnostics[0].range });

    expect(quickfixResult).toHaveLength(1);
    expect(quickfixResult[0].title).toEqual(MSG_QUICKFIX_CONVERT_TO_STRING);
    expect(quickfixResult[0].edit.changes[FILENAME][0].newText).toMatch(/for:index="idx"/);
    expect(quickfixResult[0].edit.changes[FILENAME][0].range).toMatchObject(diagnostics[0].range);
});

it('returns a list of quickfixes for fixing a wrong if: modifier', () => {
    const content = `<template><template if:tr={some}></template><template if:={some}></template></template>`;
    const document = TextDocument.create(FILENAME, 'html', 0, content);
    const diagnostics = templateLinter(document);

    const quickfixResult = quickfix(document, { context: { diagnostics }, textDocument: null, range: diagnostics[0].range });

    expect(quickfixResult).toHaveLength(4);
    expect(quickfixResult[0].title).toEqual(MSG_QUICKFIX_IF_TRUE);
    expect(quickfixResult[0].edit.changes[FILENAME][0].newText).toMatch(/if:true={some}/);
    expect(quickfixResult[0].edit.changes[FILENAME][0].range).toMatchObject(diagnostics[0].range);
    expect(quickfixResult[1].title).toEqual(MSG_QUICKFIX_IF_FALSE);
    expect(quickfixResult[1].edit.changes[FILENAME][0].newText).toMatch(/if:false={some}/);
    expect(quickfixResult[1].edit.changes[FILENAME][0].range).toMatchObject(diagnostics[0].range);
    expect(quickfixResult[2].title).toEqual(MSG_QUICKFIX_IF_TRUE);
    expect(quickfixResult[2].edit.changes[FILENAME][0].newText).toMatch(/if:true={some}/);
    expect(quickfixResult[2].edit.changes[FILENAME][0].range).toMatchObject(diagnostics[1].range);
    expect(quickfixResult[3].title).toEqual(MSG_QUICKFIX_IF_FALSE);
    expect(quickfixResult[3].edit.changes[FILENAME][0].newText).toMatch(/if:false={some}/);
    expect(quickfixResult[3].edit.changes[FILENAME][0].range).toMatchObject(diagnostics[1].range);
});

// TODO
it('returns a list of quickfixes for ambiguous expressions', () => {
    const content = `<template><template iterator:it="{someProp}"></template><template for:each="{someProp}" for:item="{item}" for:index="{idx}"><div key="{item}"></div></template><template if:true="{some}"></template><template if:false="{some}"></template></template>`;
    const document = TextDocument.create(FILENAME, 'html', 0, content);
    const diagnostics = templateLinter(document);

    const quickfixResult = quickfix(document, { context: { diagnostics }, textDocument: null, range: diagnostics[0].range });

    expect(quickfixResult).toHaveLength(7);
    expect(quickfixResult[0].title).toEqual(MSG_QUICKFIX_AMBIGUITY);
    expect(quickfixResult[0].edit.changes[FILENAME][0].newText).toMatch(/iterator:it={someProp}/);
    expect(quickfixResult[0].edit.changes[FILENAME][0].range).toMatchObject(diagnostics[0].range);
    expect(quickfixResult[1].title).toEqual(MSG_QUICKFIX_AMBIGUITY);
    expect(quickfixResult[1].edit.changes[FILENAME][0].newText).toMatch(/for:each={someProp}/);
    expect(quickfixResult[1].edit.changes[FILENAME][0].range).toMatchObject(diagnostics[1].range);
    expect(quickfixResult[2].title).toEqual(MSG_QUICKFIX_AMBIGUITY);
    expect(quickfixResult[2].edit.changes[FILENAME][0].newText).toMatch(/for:item="item"/);
    expect(quickfixResult[2].edit.changes[FILENAME][0].range).toMatchObject(diagnostics[2].range);
    expect(quickfixResult[3].title).toEqual(MSG_QUICKFIX_AMBIGUITY);
    expect(quickfixResult[3].edit.changes[FILENAME][0].newText).toMatch(/for:index="idx"/);
    expect(quickfixResult[3].edit.changes[FILENAME][0].range).toMatchObject(diagnostics[3].range);
    expect(quickfixResult[4].title).toEqual(MSG_QUICKFIX_AMBIGUITY);
    expect(quickfixResult[4].edit.changes[FILENAME][0].newText).toMatch(/key={item}/);
    expect(quickfixResult[4].edit.changes[FILENAME][0].range).toMatchObject(diagnostics[4].range);
    expect(quickfixResult[5].title).toEqual(MSG_QUICKFIX_AMBIGUITY);
    expect(quickfixResult[5].edit.changes[FILENAME][0].newText).toMatch(/if:true={some}/);
    expect(quickfixResult[5].edit.changes[FILENAME][0].range).toMatchObject(diagnostics[5].range);
    expect(quickfixResult[6].title).toEqual(MSG_QUICKFIX_AMBIGUITY);
    expect(quickfixResult[6].edit.changes[FILENAME][0].newText).toMatch(/if:false={some}/);
    expect(quickfixResult[6].edit.changes[FILENAME][0].range).toMatchObject(diagnostics[6].range);
});

it('returns a quickfix for disallowed expressions', () => {
    const content = `<template><template if:true={!!someProp[value.key]}></template></template>`;
    const document = TextDocument.create(FILENAME, 'html', 0, content);
    const diagnostics = templateLinter(document);

    const quickfixResult = quickfix(document, { context: { diagnostics }, textDocument: null, range: diagnostics[0].range });

    expect(quickfixResult).toHaveLength(1);
    expect(quickfixResult[0].title).toEqual(MSG_QUICKFIX_FIX_INVALID_EXPRESSION);
    expect(quickfixResult[0].edit.changes[FILENAME][0].newText).toMatch(/if:true={someProp}/);
    expect(quickfixResult[0].edit.changes[FILENAME][0].range).toMatchObject(diagnostics[0].range);
});

it('returns a quickfix for inserting a key into an iterators first node', () => {
    const content = `<template><template for:each={someProp} for:item="item"><div></div></template></template>`;
    const document = TextDocument.create(FILENAME, 'html', 0, content);
    const diagnostics = templateLinter(document);

    const quickfixResult = quickfix(document, { context: { diagnostics }, textDocument: null, range: diagnostics[0].range });

    expect(quickfixResult).toHaveLength(1);
    expect(quickfixResult[0].title).toEqual(MSG_QUICKFIX_INSERT_KEY);
    expect(quickfixResult[0].edit.changes[FILENAME][0].newText).toMatch(/<div key={}><\/div>/);
    expect(quickfixResult[0].edit.changes[FILENAME][0].range).toMatchObject(diagnostics[0].range);
});

it('returns quickfix for inserting @api decorator import', async () => {
    const content = `
    import { LightningElement } from 'lwc';
    
    export default class Foo extends LightningElement {
        @api property;
    }
    `;
    const document = TextDocument.create(FILENAME_JS, 'javascript', 0, content);
    const { diagnostics } = await javascriptCompileDocument(document);

    const quickfixResult = quickfix(document, { context: { diagnostics }, textDocument: null, range: diagnostics[0].range });

    expect(quickfixResult).toHaveLength(1);
    expect(quickfixResult[0].title).toEqual(MSG_QUICKFIX_IMPORT_DECORATOR.replace(/@/, 'api'));
    expect(quickfixResult[0].edit.changes[FILENAME_JS][0].newText).toMatch(/, api /);
});

it('returns quickfix for inserting @track decorator import', async () => {
    const content = `
    import { LightningElement } from 'lwc';
    
    export default class Foo extends LightningElement {
        @track other;
    }
    `;
    const document = TextDocument.create(FILENAME_JS, 'javascript', 0, content);
    const { diagnostics } = await javascriptCompileDocument(document);

    const quickfixResult = quickfix(document, { context: { diagnostics }, textDocument: null, range: diagnostics[0].range });

    expect(quickfixResult).toHaveLength(1);
    expect(quickfixResult[0].title).toEqual(MSG_QUICKFIX_IMPORT_DECORATOR.replace(/@/, 'track'));
    expect(quickfixResult[0].edit.changes[FILENAME_JS][0].newText).toMatch(/, track /);
});

it('returns quickfix for inserting @wire decorator import', async () => {
    const content = `
    import { LightningElement } from 'lwc';
    
    export default class Foo extends LightningElement {
        @wire some;
    }
    `;
    const document = TextDocument.create(FILENAME_JS, 'javascript', 0, content);
    const { diagnostics } = await javascriptCompileDocument(document);

    const quickfixResult = quickfix(document, { context: { diagnostics }, textDocument: null, range: diagnostics[0].range });

    expect(quickfixResult).toHaveLength(1);
    expect(quickfixResult[0].title).toEqual(MSG_QUICKFIX_IMPORT_DECORATOR.replace(/@/, 'wire'));
    expect(quickfixResult[0].edit.changes[FILENAME_JS][0].newText).toMatch(/, wire /);
});

it('returns no quickfix for inserting unknown decorator import', async () => {
    const content = `
    import { LightningElement } from 'lwc';
    
    export default class Foo extends LightningElement {
        @whatever some;
    }
    `;
    const document = TextDocument.create(FILENAME_JS, 'javascript', 0, content);
    const { diagnostics } = await javascriptCompileDocument(document);

    const quickfixResult = quickfix(document, { context: { diagnostics }, textDocument: null, range: diagnostics[0].range });

    expect(quickfixResult).toHaveLength(0);
});
