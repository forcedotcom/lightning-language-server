import * as path from 'path';
import { TextDocument } from 'vscode-languageserver';
import { DIAGNOSTIC_SOURCE, MAX_32BIT_INTEGER } from '../../constants';
import { compile, transform } from '@lwc/compiler';
import { Metadata } from '../../decorators';
import { CompileOptions } from '@lwc/compiler/dist/types/options';
import * as fs from 'fs-extra';

import {
    compileDocument,
    compileFile,
    compileSource,
    getApiMethods,
    getMethods,
    getPrivateReactiveProperties,
    getProperties,
    getPublicReactiveProperties,
    extractLocationFromBabelError,
    extractMessageFromBabelError,
} from '../compiler';

const codeOk = `
import { LightningElement } from 'lwc';
export default class Foo extends LightningElement {}
`;

function pretify(str: string): string {
    return str
        .toString()
        .replace(/^\s+|\s+$/, '')
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length)
        .join('\n');
}

it('can use transform from lwc-compiler', async () => {
    const expected = `
        import _tmpl from "./foo.html";
        import { registerComponent as _registerComponent } from "lwc";
        import { LightningElement } from 'lwc';
        class Foo extends LightningElement {}
        export default _registerComponent(Foo, {
        tmpl: _tmpl
        });
    `;

    const options: CompileOptions = {
        name: 'foo',
        namespace: 'x',
        files: {},
    };
    const transformerResult = await transform(codeOk, 'foo.js', options);
    const code = transformerResult.code;
    expect(pretify(code)).toBe(pretify(expected));
});

it('can use compile from lwc-compiler', async () => {
    const expected = `
    define('x/foo', ['lwc'], function (lwc) {
    function tmpl($api, $cmp, $slotset, $ctx) {
    return [];
    }
    var _tmpl = lwc.registerTemplate(tmpl);
    tmpl.stylesheets = [];
    tmpl.stylesheetTokens = {
    hostAttribute: \"x-foo_foo-host\",
    shadowAttribute: \"x-foo_foo\"
    };
    class Foo extends lwc.LightningElement {}
    var foo = lwc.registerComponent(Foo, {
    tmpl: _tmpl
    });
    return foo;
    });
    `;

    const options: CompileOptions = {
        name: 'foo',
        namespace: 'x',
        files: {
            'foo.js': codeOk,
            'foo.html': '<template></template>',
        },
    };
    const compilerOutput = await compile(options);
    const code = compilerOutput.result.code;
    expect(pretify(code)).toBe(pretify(expected));
});

const codeSyntaxError = `
import { LightningElement } from 'lwc';
export default class Foo extends LightningElement {
    connectCallb ack() {}
}
`;

const codeError = `
import { LightningElement, api } from 'lwc';

export default class Foo extends LightningElement {
    @api property = true;
}
`;

it('transform throws exceptions on syntax errors', async () => {
    try {
        const options: CompileOptions = {
            name: 'foo',
            namespace: 'x',
            files: {},
        };
        await transform(codeSyntaxError, 'foo.js', options);
        fail('expects exception');
    } catch (err) {
        // verify err has the info we need
        const message = extractMessageFromBabelError(err.message);
        expect(message).toMatch('Unexpected token (4:17)');
        expect(err.location).toEqual({ line: 4, column: 17 });
    }
});

it('transform also throws exceptions for other errors', async () => {
    const options: CompileOptions = {
        name: 'foo',
        namespace: 'x',
        files: {},
    };
    try {
        await transform(codeError, 'foo.js', options);
    } catch (err) {
        // verify err has the info we need
        const message = extractMessageFromBabelError(err.message);
        expect(message).toMatch('Boolean public property must default to false.');
        const location = extractLocationFromBabelError(err.message);
        expect(location).toEqual({ line: 5, column: 4 });
    }
});

it('compile returns diagnostics on syntax errors', async () => {
    const options: CompileOptions = {
        name: 'foo',
        namespace: 'x',
        files: {
            'foo.js': codeSyntaxError,
            'foo.html': '<template></template>',
        },
    };
    await compile(options);
    const compilerOutput = await compile(options);
    // verify err has the info we need
    const diagnostic = compilerOutput.diagnostics[0];
    expect(diagnostic.filename).toBe('foo.js');
    expect(diagnostic.message).toMatch(/Unexpected token/);
    // TODO: diagnostic missing location info
});

it('compile also returns diagnostics for other errors', async () => {
    const options: CompileOptions = {
        name: 'foo',
        namespace: 'x',
        files: {
            'foo.js': codeError,
            'foo.html': '<template></template>',
        },
    };
    await compile(options);
    const compilerOutput = await compile(options);
    // verify err has the info we need
    const diagnostic = compilerOutput.diagnostics[0];
    expect(diagnostic.filename).toBe('foo.js');
    expect(diagnostic.message).toMatch(/Boolean public property must default to false/);
    // TODO: diagnostic missing location info
});

it('compileDocument returns list of javascript syntax errors', async () => {
    const document = TextDocument.create('file:///example.js', 'javascript', 0, codeSyntaxError);
    const { diagnostics } = await compileDocument(document);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toMatch('Unexpected token (4:17)');
    expect(diagnostics[0].range).toMatchObject({
        start: { character: 17 },
        end: { character: MAX_32BIT_INTEGER },
    });
    expect(diagnostics[0].source).toBe(DIAGNOSTIC_SOURCE);
});

it('compileDocument returns list of javascript regular errors', async () => {
    const document = TextDocument.create('file:///example.js', 'javascript', 0, codeError);
    const { diagnostics } = await compileDocument(document);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toMatch('Boolean public property must default to false.');
    expect(diagnostics[0].range).toMatchObject({
        start: { character: 4 },
        end: { character: MAX_32BIT_INTEGER },
    });
    expect(diagnostics[0].source).toBe(DIAGNOSTIC_SOURCE);
});

it('linter returns empty diagnostics on correct file', async () => {
    const content = `
    import { LightningElement } from 'lwc';
    export default class Foo extends LightningElement {
        connectedCallback() {}
    }
`;

    const { diagnostics } = await compileSource(content);
    expect(diagnostics).toEqual([]);
});

it('transform returns javascript metadata', async () => {
    const filepath = path.join('src', 'javascript', '__tests__', 'fixtures', 'metadata.js');
    const content = fs.readFileSync(filepath, 'utf8');

    const options: CompileOptions = {
        name: 'metadata',
        namespace: 'x',
        files: {},
    };
    const transformerResult = await transform(content, 'metadata.js', options);
    const metadata: Metadata = transformerResult.map.metadata as Metadata;

    const properties = getProperties(metadata);

    expect(metadata.doc).toBe('* Foo doc');
    expect(metadata.declarationLoc).toEqual({ start: { column: 0, line: 3 }, end: { column: 1, line: 31 } });

    expect(getPublicReactiveProperties(metadata)).toMatchObject([{ name: 'todo' }, { name: 'index' }, { name: 'indexSameLine' }]);
    expect(properties).toMatchObject([
        { name: 'todo' },
        { name: 'index' },
        { name: 'indexSameLine' },
        { name: 'trackedPrivateIndex' },
        { name: 'privateComputedValue' },
    ]);
    expect(getMethods(metadata)).toMatchObject([{ name: 'onclickAction' }, { name: 'apiMethod' }, { name: 'methodWithArguments' }]);

    expect(getPrivateReactiveProperties(metadata)).toMatchObject([{ name: 'trackedPrivateIndex' }]);
    expect(getApiMethods(metadata)).toMatchObject([{ name: 'apiMethod' }]);

    // location of @api properties
    const indexProperty = properties[1];
    expect(indexProperty).toMatchObject({ name: 'index', loc: { start: { column: 4, line: 11 }, end: { column: 10, line: 12 } } });
    const indexSameLineProperty = properties[2];
    expect(indexSameLineProperty).toMatchObject({ name: 'indexSameLine', loc: { start: { column: 4, line: 14 }, end: { column: 23, line: 14 } } });
});

it('returns javascript metadata', async () => {
    const filepath = path.join('src', 'javascript', '__tests__', 'fixtures', 'metadata.js');
    const content = fs.readFileSync(filepath, 'utf8');

    const compilerResult = await compileSource(content, 'metadata.js');
    const metadata = compilerResult.metadata;
    const properties = getProperties(metadata);

    expect(metadata.doc).toBe('Foo doc');
    expect(metadata.declarationLoc).toEqual({ start: { column: 0, line: 3 }, end: { column: 1, line: 31 } });

    expect(getPublicReactiveProperties(metadata)).toMatchObject([{ name: 'todo' }, { name: 'index' }, { name: 'indexSameLine' }]);
    expect(properties).toMatchObject([
        { name: 'todo' },
        { name: 'index' },
        { name: 'indexSameLine' },
        { name: 'trackedPrivateIndex' },
        { name: 'privateComputedValue' },
    ]);
    expect(getMethods(metadata)).toMatchObject([{ name: 'onclickAction' }, { name: 'apiMethod' }, { name: 'methodWithArguments' }]);

    expect(getPrivateReactiveProperties(metadata)).toMatchObject([{ name: 'trackedPrivateIndex' }]);
    expect(getApiMethods(metadata)).toMatchObject([{ name: 'apiMethod' }]);

    // location of @api properties
    const indexProperty = properties[1];
    expect(indexProperty).toMatchObject({ name: 'index', loc: { start: { column: 4, line: 11 }, end: { column: 10, line: 12 } } });
    const indexSameLineProperty = properties[2];
    expect(indexSameLineProperty).toMatchObject({ name: 'indexSameLine', loc: { start: { column: 4, line: 14 }, end: { column: 23, line: 14 } } });
});

it('use compileDocument()', async () => {
    const content = `
        import { LightningElement, api } from 'lwc';
        export default class Foo extends LightningElement {
            @api
            index;
        }
    `;

    const document = TextDocument.create('file:///foo.js', 'javascript', 0, content);
    const { metadata } = await compileDocument(document);
    const publicProperties = getPublicReactiveProperties(metadata);
    expect(publicProperties).toMatchObject([{ name: 'index' }]);
});

it('use compileFile()', async () => {
    const filepath = path.join('src', 'javascript', '__tests__', 'fixtures', 'foo.js');
    const { metadata } = await compileFile(filepath);
    const publicProperties = getPublicReactiveProperties(metadata);
    expect(publicProperties).toMatchObject([{ name: 'index' }]);
});
