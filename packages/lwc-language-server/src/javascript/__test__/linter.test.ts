import { TextDocument } from 'vscode-languageserver';
import { transform } from 'raptor-compiler';
import javascriptLinter from '../linter';
import { DIAGNOSTIC_SOURCE } from '../../constants';

it('can use transform(src, id, options) from raptor-compiler', async () => {
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

    const diagnostics = await javascriptLinter(document);

    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].message).toMatch(
        /example.js: Wrong lifecycle method name connectCallback. You probably meant connectedCallback/,
    );
    expect(diagnostics[0].range).toMatchObject({
        start: { character: 8 },
        end: { character: 9 },
    });
    expect(diagnostics[0].source).toBe(DIAGNOSTIC_SOURCE);
});

function pretify(str) {
    return str.toString()
        .replace(/^\s+|\s+$/, '')
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length)
        .join('\n');
}
