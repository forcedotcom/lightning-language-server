import * as path from 'path';
import { TextDocument } from 'vscode-languageserver';
import { transform } from '../../resources/lwc/compiler';
import { compileSource, compileDocument, compileFile } from '../compiler';
import { DIAGNOSTIC_SOURCE } from '../../constants';

const FIXTURE_DIR = path.join(__dirname, 'fixtures');

it('can use transform(src, id, options) from lwc-compiler', async () => {
    const actual = `
        import { Element } from 'engine';
        export default class Foo extends Element {}
    `;

    const expected = `
        import _tmpl from './foo.html';
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
        connectCallback() {}
    }
`;

    try {
        await transform(code, 'foo.js', { moduleNamespace: 'x', moduleName: 'foo' });
        fail('expects exception');
    } catch (err) {
        // verify err has the info we need
        expect(err.message).toMatch(
            /Wrong lifecycle method name connectCallback. You probably meant connectedCallback/,
        );
        expect(err.loc).toEqual({ line: 4, column: 8 });
    }
});

it('returns list of javascript compilation errors', async () => {
    const content = `
    import { Element } from 'engine';
    export default class Foo extends Element {
        connectCallback() {}
    }
`;

    const document = TextDocument.create('file:///example.js', 'javascript', 0, content);
    const { diagnostics } = await compileDocument(document);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toMatch(
        /example.js: Wrong lifecycle method name connectCallback. You probably meant connectedCallback/,
    );
    expect(diagnostics[0].range).toMatchObject({
        start: { character: 8 },
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
        import { Element } from 'engine';
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
        }
    `;

    const { result } = await compileSource(content);
    const metadata = result.metadata;
    expect(metadata.apiProperties).toMatchObject([{ name: 'todo' }, { name: 'index' }]);
    expect(metadata.doc).toBe('Foo doc');
    expect(metadata.declarationLoc).toEqual({ start: { column: 8, line: 4 }, end: { column: 9, line: 14 }});
});

it('use compileDocument()', async () => {
    const content = `
        import { Element } from 'engine';
        export default class Foo extends Element {
            @api
            index;
        }
    `;

    const document = TextDocument.create('file:///foo.js', 'javascript', 0, content);
    const { result } = await compileDocument(document);
    expect(result.metadata.apiProperties).toMatchObject([{ name: 'index' }]);
});

it('use compileFile()', async () => {
    const filepath = path.join(FIXTURE_DIR, 'foo.js');
    const { result } = await compileFile(filepath);
    expect(result.metadata.apiProperties).toMatchObject([{ name: 'index' }]);
});

function pretify(str: string) {
    return str.toString()
        .replace(/^\s+|\s+$/, '')
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length)
        .join('\n');
}
