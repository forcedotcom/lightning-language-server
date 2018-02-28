import * as path from 'path';
import { TextDocument } from 'vscode-languageserver';
import { transform } from '../../resources/lwc/compiler';
import { compileSource, compileDocument, compileFile, getPublicReactiveProperties } from '../compiler';
import { DIAGNOSTIC_SOURCE } from '../../constants';

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
    const content = `
        import { Element, api, track } from 'engine';
        /** Foo doc */
        export default class Foo extends Element {
            _privateTodo;
            @api get todo () {
                return this._privateTodo;
            }
            @api set todo (val) {
                return this._privateTodo = val;
            }
            @api
            index;

            @track
            trackedIndex;

            onclickAction() {
            }

            @api focus() {
            }
        }
    `;

    const compilerResult = await compileSource(content);
    const metadata = compilerResult.result.metadata;
    const publicProperties = getPublicReactiveProperties(metadata);

    expect(publicProperties).toMatchObject([{ name: 'todo' }, { name: 'index' }]);
    expect(metadata.doc).toBe('Foo doc');
    expect(metadata.declarationLoc).toEqual({ start: { column: 8, line: 4 }, end: { column: 9, line: 23 } });
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
