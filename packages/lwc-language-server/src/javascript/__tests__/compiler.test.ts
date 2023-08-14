import * as path from 'path';
import { TextDocument } from 'vscode-languageserver';
import { DIAGNOSTIC_SOURCE, MAX_32BIT_INTEGER } from '../../constants';
import { collectBundleMetadata, BundleConfig, ScriptFile } from '@lwc/metadata';
import { mapLwcMetadataToInternal } from '../type-mapping';
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
} from '../compiler';

const codeOk = `
import { LightningElement } from 'lwc';
export default class Foo extends LightningElement {}
`;
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

it('can get metadata from a simple component', async () => {
    await compileSource(codeOk, 'foo.js');
});

it('displays an error for a component with syntax error', async () => {
    const result = await compileSource(codeSyntaxError, 'foo.js');
    expect(result.metadata).toBeUndefined();
    expect(result.diagnostics).toHaveLength(1);
    const [diagnostic] = result.diagnostics;
    expect(diagnostic.message).toMatch('Unexpected token (4:17)');
});

it('displays an error for a component with other errors', async () => {
    const result = await compileSource(codeError, 'foo.js');
    expect(result.metadata).toBeUndefined();
    expect(result.diagnostics).toHaveLength(1);

    const [diagnostic] = result.diagnostics;
    expect(diagnostic.message).toMatch('Boolean public property must default to false.');
    expect(diagnostic.range).toEqual({
        start: {
            line: 4,
            character: 4,
        },
        end: {
            line: 4,
            character: MAX_32BIT_INTEGER,
        },
    });
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

it('mapLwcMetadataToInternal returns expected javascript metadata', async () => {
    const filepath = path.join('src', 'javascript', '__tests__', 'fixtures', 'metadata.js');
    const content = fs.readFileSync(filepath, 'utf8');

    const options: BundleConfig = {
        type: 'internal',
        name: 'metadata',
        namespace: 'x',
        namespaceMapping: {},
        files: [
            {
                fileName: 'metadata.js',
                source: content,
            },
        ],
    };

    const modernMetadata = collectBundleMetadata(options);
    const metadata = mapLwcMetadataToInternal(modernMetadata.files[0] as ScriptFile);
    const properties = getProperties(metadata);

    expect(metadata.doc).toBe('* Foo doc');
    expect(metadata.declarationLoc).toEqual({
        start: { column: 0, line: 8 },
        end: { column: 1, line: 80 },
    });

    expect(getPublicReactiveProperties(metadata)).toMatchObject([
        { name: 'todo' },
        { name: 'index' },
        { name: 'initializedAsApiNumber' },
        { name: 'indexSameLine' },
        { name: 'initializedWithImportedVal' },
        { name: 'arrOfStuff' },
        { name: 'stringVal' },
        { name: 'callback' },
        { name: 'fooNull' },
        { name: 'superComplex' },
    ]);
    expect(properties).toMatchObject([
        { name: 'todo' },
        { name: 'index' },
        { name: 'initializedAsApiNumber' },
        { name: 'initializedAsTrackNumber' },
        { name: 'indexSameLine' },
        { name: 'initializedWithImportedVal' },
        { name: 'arrOfStuff' },
        { name: 'trackedPrivateIndex' },
        { name: 'stringVal' },
        { name: 'trackedThing' },
        { name: 'trackedArr' },
        { name: 'callback' },
        { name: 'fooNull' },
        { name: 'superComplex' },
        { name: 'wiredProperty' },
        { name: 'wiredPropertyWithNestedParam' },
        { name: 'wiredPropertyWithNestedObjParam' },
        { name: 'apexWiredProperty' },
        { name: 'apexWiredInitVal' },
        { name: 'apexWiredInitArr' },
        { name: 'privateComputedValue' },
    ]);
    expect(getMethods(metadata)).toMatchObject([{ name: 'onclickAction' }, { name: 'apiMethod' }, { name: 'myWiredMethod' }, { name: 'methodWithArguments' }]);

    expect(getPrivateReactiveProperties(metadata)).toMatchObject([
        { name: 'initializedAsTrackNumber' },
        { name: 'trackedPrivateIndex' },
        { name: 'trackedThing' },
        { name: 'trackedArr' },
    ]);
    expect(getApiMethods(metadata)).toMatchObject([{ name: 'apiMethod' }]);

    // location of @api properties
    const indexProperty = properties[1];
    expect(indexProperty).toMatchObject({
        name: 'index',
        loc: {
            start: { column: 4, line: 16 },
            end: { column: 10, line: 17 },
        },
    });
    const indexSameLineProperty = properties[4];
    expect(indexSameLineProperty).toMatchObject({
        name: 'indexSameLine',
        loc: {
            start: { column: 4, line: 22 },
            end: { column: 23, line: 22 },
        },
    });
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

it('should be able to compile a javascript class that has no default export', async () => {
    const content = `
        export class Foo {
            a = 5;
        }
    `;

    const document = TextDocument.create('file:///foo.js', 'javascript', 0, content);
    const { metadata } = await compileDocument(document);

    expect(metadata).toMatchObject({
        decorators: [],
        classMembers: [],
        doc: '',
        declarationLoc: {
            start: {
                line: 0,
                column: 0,
            },
            end: {
                line: 0,
                column: 0,
            },
        },
        exports: [],
    });
});
