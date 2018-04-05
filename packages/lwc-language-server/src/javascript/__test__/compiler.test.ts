import * as path from 'path';
import { TextDocument } from 'vscode-languageserver';
import { DIAGNOSTIC_SOURCE } from '../../constants';
import { transform } from '../../resources/lwc/compiler';
import * as utils from '../../utils';
import {
    compileDocument,
    compileFile,
    compileSource,
    getApiMethods,
    getMethods,
    getPrivateReactiveProperties,
    getProperties,
    getPublicReactiveProperties,
} from '../compiler';

it('can use transform(src, id, options) from lwc-compiler', async () => {
    const actual = `
        import { Element } from 'engine';
        export default class Foo extends Element {}
    `;

    const expected = `
        import _tmpl from "./foo.html";
        import { Element } from 'engine';
        export default class Foo extends Element {
            render() {
                return _tmpl;
            }
        }
        Foo.style = _tmpl.style;
    `;

    const { code } = await transform(actual, 'foo.js', {
        moduleNamespace: 'x',
        moduleName: 'foo',
    });

    expect(pretify(code)).toBe(pretify(expected));
});

it('transform(src, id, options) throws exceptions on errors', async () => {
    const code = `
    import { Element } from 'engine';
    export default class Foo extends Element {
        connectCallb ack() {}
    }
`;

    try {
        await transform(code, 'foo.js', { moduleNamespace: 'x', moduleName: 'foo' });
        fail('expects exception');
    } catch (err) {
        // verify err has the info we need
        expect(err.message).toMatch(/Unexpected token/);
        expect(err.loc).toEqual({ line: 4, column: 21 });
    }
});

it('returns list of javascript compilation errors', async () => {
    const content = `
    import { Element } from 'engine';
    export default class Foo extends Element {
        connectCallb ack() {}
    }
`;

    const document = TextDocument.create('file:///example.js', 'javascript', 0, content);
    const { diagnostics } = await compileDocument(document);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toMatch(/example.js: Unexpected token/);
    expect(diagnostics[0].range).toMatchObject({
        start: { character: 21 },
        end: { character: Number.MAX_VALUE },
    });
    expect(diagnostics[0].source).toBe(DIAGNOSTIC_SOURCE);
});

it('linter returns empty diagnostics on correct file', async () => {
    const content = `
    import { Element } from 'engine';
    export default class Foo extends Element {
        connectedCallback() {}
    }
`;

    const { diagnostics } = await compileSource(content);
    expect(diagnostics).toEqual([]);
});

it('returns javascript metadata', async () => {
    const filepath = path.join('src', 'javascript', '__test__', 'fixtures', 'metadata.js');
    const content = utils.readFileSync(filepath);

    const compilerResult = await compileSource(content);
    const metadata = compilerResult.result.metadata;
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
        import { Element, api } from 'engine';
        export default class Foo extends Element {
            @api
            index;
        }
    `;

    const document = TextDocument.create('file:///foo.js', 'javascript', 0, content);
    const { result } = await compileDocument(document);
    const publicProperties = getPublicReactiveProperties(result.metadata);
    expect(publicProperties).toMatchObject([{ name: 'index' }]);
});

it('use compileFile()', async () => {
    const filepath = path.join('src', 'javascript', '__test__', 'fixtures', 'foo.js');
    const { result } = await compileFile(filepath);
    const publicProperties = getPublicReactiveProperties(result.metadata);
    expect(publicProperties).toMatchObject([{ name: 'index' }]);
});

function pretify(str: string) {
    return str
        .toString()
        .replace(/^\s+|\s+$/, '')
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length)
        .join('\n');
}
