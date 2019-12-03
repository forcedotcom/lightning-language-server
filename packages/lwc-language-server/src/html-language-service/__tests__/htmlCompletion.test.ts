import * as path from 'path';
import { CompletionItem, Position, TextDocument, TextEdit } from 'vscode-languageserver';
import { getLanguageService } from 'lightning-lsp-common';
import { LWCIndexer } from '../../indexer';
import { WorkspaceContext, shared } from 'lightning-lsp-common';
const { WorkspaceType } = shared;

import { FORCE_APP_ROOT, UTILS_ROOT } from './test-utils';
import * as fs from 'fs-extra';
import { getLwcTagProvider } from '../../markup/lwcTags';

beforeEach(() => {
    const jsconfigPathForceApp = FORCE_APP_ROOT + '/lwc/jsconfig.json';
    const jsconfigPathUtilsOrig = UTILS_ROOT + '/lwc/jsconfig-orig.json';
    const jsconfigPathUtils = UTILS_ROOT + '/lwc/jsconfig.json';
    const sfdxTypingsPath = 'test-workspaces/sfdx-workspace/.sfdx/typings/lwc';
    const forceignorePath = 'test-workspaces/sfdx-workspace/.forceignore';

    // make sure no generated files are there from previous runs
    fs.removeSync(jsconfigPathForceApp);
    fs.copySync(jsconfigPathUtilsOrig, jsconfigPathUtils);
    fs.removeSync(forceignorePath);
    fs.removeSync(sfdxTypingsPath);
});

interface ICompletionMatcher {
    label: string;
    result: string;
    documentation?: string;
    detail?: string;
}

function applyEdit(document: TextDocument, edit: TextEdit): string {
    let text = document.getText();
    const startOffset = document.offsetAt(edit.range.start);
    const endOffset = document.offsetAt(edit.range.end);
    text = text.substring(0, startOffset) + edit.newText + text.substring(endOffset, text.length);
    return text;
}

function testCompletion(content: string, matchers: ICompletionMatcher[] = [], sfdxProject: boolean = true, docName: string = 'test://test.html') {
    const [before, after] = content.split('|');
    const document = TextDocument.create(docName, 'html', 0, before + after);
    const position = Position.create(0, before.length);
    const ls = getLanguageService();
    if (ls.getTagProviders().length === 0) {
        // Only add the tag provider once
        ls.addTagProvider(getLwcTagProvider());
    }
    const htmlDocument = ls.parseHTMLDocument(document);
    const items = ls.doComplete(document, position, htmlDocument, { isSfdxProject: sfdxProject });

    matchers.forEach(matcher => {
        const item = items.items.find(candidate => matcher.label === candidate.label);
        expect(item).toBeDefined();
        if (matcher.documentation) {
            expect(item.documentation).toContain(matcher.documentation);
        }
        if (matcher.detail) {
            expect(item.detail).toBe(matcher.detail);
        }
        expect(applyEdit(document, item.textEdit)).toEqual(matcher.result);
    });

    return items.items;
}

let res: CompletionItem[];

it('completion', async () => {
    res = testCompletion('<template>|</template>');
    expect(res).toHaveLength(1);

    res = testCompletion('<template |');
    expect(res).toHaveLength(6); // TODO need to look back and see why this went from 5 -> 6

    testCompletion('<template><div |', [
        {
            label: 'if:true',
            result: '<template><div if:true=$1',
            documentation: 'Renders the element or template if the expression value is thruthy.',
            detail: 'LWC directive',
        },
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
});

it('completion in sfdx workspace', async () => {
    const context = new WorkspaceContext('test-workspaces/sfdx-workspace');
    await context.configureProject();
    const lwcIndexer = new LWCIndexer(context);
    await lwcIndexer.configureAndIndex();
    context.addIndexingProvider({ name: 'lwc', indexer: lwcIndexer });

    expect(context.type).toBe(WorkspaceType.SFDX);
    res = testCompletion('<template><lightning-');
    expect(res.length).toBeGreaterThan(10);

    testCompletion('<template><lightning-button-icon-stateful a', [
        {
            label: 'alternative-text',
            result: '<template><lightning-button-icon-stateful alternative-text=$1',
            documentation: 'The alternative text used to describe the icon.',
            detail: 'LWC standard attribute',
        },
    ]);

    // tag completion:
    testCompletion('<template><c-todo_it', [{ label: 'c-todo_item', result: '<template><c-todo_item' }]);

    // attribute completion:
    testCompletion('<template><c-todo_item tod|', [
        {
            label: 'todo',
            result: '<template><c-todo_item todo=$1',
            documentation: 'todo jsdoc',
            detail: 'LWC custom attribute',
        },
    ]);
    testCompletion('<template><c-todo_util inf|', [{ label: 'info', result: '<template><c-todo_util info=$1' }]);
    testCompletion('<template><c-todo_util ico|', [{ label: 'icon-name', result: '<template><c-todo_util icon-name=$1' }]);
    testCompletion('<template><c-todo_util upp|', [{ label: 'upper-c-a-s-e', result: '<template><c-todo_util upper-c-a-s-e=$1' }]);

    // expression completion:
    testCompletion(
        '<template>{|}',
        [
            { label: 'info', result: '<template>{info}' },
            { label: 'iconName', result: '<template>{iconName}' },
            { label: 'upperCASE', result: '<template>{upperCASE}' },
            { label: 'trackProperty', result: '<template>{trackProperty}' },
            { label: 'privateProperty', result: '<template>{privateProperty}' },
            { label: 'privateMethod', result: '<template>{privateMethod}' },
        ],
        true,
        path.join('todo_util', 'todo_util.html'),
    );
    testCompletion('<template>{inf|}', [{ label: 'info', result: '<template>{info}' }], true, path.join('todo_util', 'todo_util.html'));
    testCompletion('<template class={in|}>', [{ label: 'info', result: '<template class={info}>' }], true, path.join('todo_util', 'todo_util.html'));
    // missing clossing } at tag end:
    testCompletion('<template class={in|>', [{ label: 'info', result: '<template class={info}>' }], true, path.join('todo_util', 'todo_util.html'));
});

it('completion in core workspace', async () => {
    const context = new WorkspaceContext('test-workspaces/core-like-workspace/app/main/core');
    await context.configureProject();
    const lwcIndexer = new LWCIndexer(context);
    await lwcIndexer.configureAndIndex();
    context.addIndexingProvider({ name: 'lwc', indexer: lwcIndexer });

    expect(context.type).toBe(WorkspaceType.CORE_ALL);
    res = testCompletion('<template><lightning-');
    expect(res.length).toBeGreaterThan(10);

    testCompletion('<template><lightning-button-icon-stateful a', [
        {
            label: 'alternative-text',
            result: '<template><lightning-button-icon-stateful alternative-text=$1',
            documentation: 'The alternative text used to describe the icon.',
            detail: 'LWC standard attribute',
        },
    ]);

    // tag completion:
    testCompletion('<template><force-inp', [{ label: 'force-input-phone', result: '<template><force-input-phone' }], false);
    // attribute completion:
    testCompletion('<template><force-input-phone val|', [{ label: 'value', result: '<template><force-input-phone value=$1' }], false);
    // expression completion:
    testCompletion('<template>{val|}', [{ label: 'value', result: '<template>{value}' }], false, path.join('force', 'input-phone', 'input-phone.html'));
});

it('completion in standard workspace', async () => {
    const context = new WorkspaceContext('test-workspaces/standard-workspace');
    await context.configureProject();
    const lwcIndexer = new LWCIndexer(context);
    await lwcIndexer.configureAndIndex();
    context.addIndexingProvider({ name: 'lwc', indexer: lwcIndexer });

    expect(context.type).toBe(WorkspaceType.STANDARD_LWC);
    res = testCompletion('<template><lightning-');
    expect(res.length).toBeGreaterThan(3);

    // tag completion:
    testCompletion('<template><example-lin', [{ label: 'example-line', result: '<template><example-line' }], false);
    // attribute completion:
    testCompletion('<template><example-line te|', [{ label: 'text', result: '<template><example-line text=$1' }], false);
    // expression completion:
    testCompletion('<template>{te|}', [{ label: 'text', result: '<template>{text}' }], false, path.join('example', 'line', 'line.html'));
});
