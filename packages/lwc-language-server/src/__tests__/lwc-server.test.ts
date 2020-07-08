import Server, { Token, findDynamicContent } from '../lwc-server';
import { getLanguageService } from 'vscode-html-languageservice';
import { TextDocument, InitializeParams, TextDocumentPositionParams, Location, MarkedString, MarkupContent, Hover } from 'vscode-languageserver';

import URI from 'vscode-uri';
import * as fsExtra from 'fs-extra';
import * as path from 'path';

const filename = path.resolve('../../test-workspaces/sfdx-workspace/force-app/main/default/lwc/todo/todo.html');
const uri = URI.file(filename).toString();
const document: TextDocument = TextDocument.create(uri, 'html', 0, fsExtra.readFileSync(filename).toString());

const auraFilename = path.resolve('../../test-workspaces/sfdx-workspace/force-app/main/default/aura/todoApp/todoApp.app');
const auraUri = URI.file(auraFilename).toString();
const auraDocument: TextDocument = TextDocument.create(auraFilename, 'html', 0, fsExtra.readFileSync(auraFilename).toString());

const server: Server = new Server();

jest.mock('vscode-languageserver', () => {
    const actual = jest.requireActual('vscode-languageserver');
    return {
        ...actual,
        createConnection: jest.fn().mockImplementation(() => {
            return {
                onInitialize: () => true,
                onCompletion: () => true,
                onCompletionResolve: () => true,
                onHover: () => true,
                onShutdown: () => true,
                onDefinition: () => true,
            };
        }),
        TextDocuments: jest.fn().mockImplementation(() => {
            return {
                listen: () => true,
                onDidChangeContent: () => true,
                get: (name: string) => {
                    const docs = new Map([
                        [uri, document],
                        [auraUri, auraDocument],
                    ]);
                    return docs.get(name);
                },
                onDidSave: () => true,
                syncKind: 'html',
            };
        }),
    };
});

describe('new', () => {
    it('creates a new instance', () => {
        expect(server.connection);
        expect(server.documents);
    });
});

describe('handlers', () => {
    const initializeParams: InitializeParams = {
        processId: 0,
        rootUri: '',
        capabilities: {},
        workspaceFolders: [
            {
                uri: URI.file(path.resolve('../../test-workspaces/sfdx-workspace/')).toString(),
                name: path.resolve('../../test-workspaces/sfdx-workspace/'),
            },
        ],
    };

    describe('#onCompletion', () => {
        it('returns a list of available completion items in a LWC template', async () => {
            const params: TextDocumentPositionParams = {
                textDocument: { uri },
                position: {
                    line: 16,
                    character: 30,
                },
            };

            await server.onInitialize(initializeParams);
            const completions = await server.onCompletion(params);
            const labels = completions.items.map(item => item.label);
            expect(labels).toInclude('c-todo_item');
            expect(labels).toInclude('c-todo');
            expect(labels).toInclude('lightning-icon');
            expect(labels).not.toInclude('div');
            expect(labels).not.toInclude('lightning:icon'); // this is handled by the aura Lang. server
        });

        it('returns a list of available completion items in a Aura template', async () => {
            const params: TextDocumentPositionParams = {
                textDocument: { uri: auraUri },
                position: {
                    line: 2,
                    character: 9,
                },
            };

            await server.onInitialize(initializeParams);
            const completions = await server.onCompletion(params);
            const labels = completions.items.map(item => item.label);
            expect(labels).toInclude('c:todoItem');
            expect(labels).toInclude('c:todo');
            expect(labels).not.toInclude('div');
        });
    });

    describe('onHover', () => {
        it('returns the the docs for that hovered item', async () => {
            const params: TextDocumentPositionParams = {
                textDocument: { uri },
                position: {
                    line: 16,
                    character: 29,
                },
            };

            await server.onInitialize(initializeParams);
            await server.componentIndexer.init();
            const hover: Hover = await server.onHover(params);
            const contents = hover.contents as MarkupContent;

            expect(contents.value).toContain('**todo**');
        });

        it('returns the docs for that hovered custom component in an aura template', async () => {
            const params: TextDocumentPositionParams = {
                textDocument: { uri: auraUri },
                position: {
                    line: 3,
                    character: 9,
                },
            };

            await server.onInitialize(initializeParams);
            await server.componentIndexer.init();
            const hover: Hover = await server.onHover(params);
            const contents = hover.contents as MarkupContent;
            expect(contents.value).toContain('**info**');
            expect(contents.value).toContain('**icon-name**');
        });
    });

    describe('#onDefinition', () => {
        it('returns the Location of the html tags corresponding .js file', async () => {
            const params: TextDocumentPositionParams = {
                textDocument: { uri },
                position: {
                    line: 16,
                    character: 30,
                },
            };

            await server.onInitialize(initializeParams);
            await server.componentIndexer.init();
            const locations: Location[] = server.onDefinition(params);
            const uris = locations.map(item => item.uri);
            expect(locations.length).toEqual(2);
            expect(uris[0]).toContain('todo_item/todo_item.js');
            expect(uris[1]).toContain('todo_item/todo_item.html');
        });

        it('returns the Location of the property in the elements content', async () => {
            const params: TextDocumentPositionParams = {
                textDocument: { uri },
                position: {
                    line: 19,
                    character: 40,
                },
            };

            await server.onInitialize(initializeParams);
            await server.componentIndexer.init();
            const [location] = server.onDefinition(params);
            expect(location.uri).toContain(path.join('todo', 'todo.js'));
            expect(location.range.start.line).toEqual(103);
            expect(location.range.start.character).toEqual(4);
        });

        it('returns the Location of an (`@api`) classMember from the html attribute', async () => {
            const params: TextDocumentPositionParams = {
                textDocument: { uri },
                position: {
                    line: 18,
                    character: 27,
                },
            };

            await server.onInitialize(initializeParams);
            await server.componentIndexer.init();
            const [location]: Location[] = server.onDefinition(params);
            expect(location.range.start.line).toEqual(14);
            expect(location.range.start.character).toEqual(4);
        });

        it('returns the Location of a parent iterator node with an iterator attribute', async () => {
            const params: TextDocumentPositionParams = {
                textDocument: { uri },
                position: {
                    line: 18,
                    character: 32,
                },
            };

            await server.onInitialize(initializeParams);
            await server.componentIndexer.init();
            const [location]: Location[] = server.onDefinition(params);
            expect(location.uri).toContain('todo/todo.html');
            expect(location.range.start.line).toEqual(15);
            expect(location.range.start.character).toEqual(60);
        });
    });
});

describe('#capabilities', () => {
    it('returns what the server can do', () => {
        expect(server.capabilities).toEqual({
            capabilities: {
                textDocumentSync: 'html',
                completionProvider: {
                    resolveProvider: true,
                },
                hoverProvider: true,
                definitionProvider: true,
                workspace: {
                    workspaceFolders: {
                        supported: true,
                    },
                },
            },
        });
    });
});

describe('#cursorInfo', () => {
    server.languageService = getLanguageService();

    it('knows when Im in a start tag', () => {
        const cursorInfo = server.cursorInfo({ textDocument: { uri }, position: { line: 16, character: 23 } }, document);
        expect(cursorInfo).toEqual({ type: Token.Tag, name: 'c-todo_item', tag: 'c-todo_item' });
    });

    it('knows when Im on an attribute name', () => {
        const cursorInfo = server.cursorInfo({ textDocument: { uri }, position: { line: 17, character: 26 } }, document);
        expect(cursorInfo).toEqual({ type: Token.AttributeKey, name: 'key', tag: 'c-todo_item' });
    });

    it('knows when Im on a dynamic attribute value (inside "{}")', () => {
        const cursorInfo = server.cursorInfo({ textDocument: { uri }, position: { line: 18, character: 33 } }, document);
        expect(cursorInfo.type).toEqual(Token.DynamicAttributeValue);
        expect(cursorInfo.name).toEqual('todo');
        expect(cursorInfo.tag).toEqual('c-todo_item');
        expect(cursorInfo.range).toEqual({
            start: {
                character: 60,
                line: 15,
            },
            end: {
                character: 66,
                line: 15,
            },
        });
    });

    it('knows when Im on an attribute value', () => {
        const cursorInfo = server.cursorInfo({ textDocument: { uri }, position: { line: 7, character: 35 } }, document);
        expect(cursorInfo).toEqual({ type: Token.AttributeValue, name: '"off"', tag: 'input' });
    });

    it('knows when Im in content', () => {
        const cursorInfo = server.cursorInfo({ textDocument: { uri }, position: { line: 37, character: 24 } }, document);
        expect(cursorInfo.type).toEqual(Token.Content);
        expect(cursorInfo.tag).toEqual('button');
    });

    it('knows when Im in dynamic content', () => {
        const cursorInfo = server.cursorInfo({ textDocument: { uri }, position: { line: 27, character: 68 } }, document);
        expect(cursorInfo.type).toEqual(Token.DynamicContent);
        expect(cursorInfo.tag).toEqual('strong');
    });

    it('knows when Im not dynamic content', () => {
        const cursorInfo = server.cursorInfo({ textDocument: { uri }, position: { line: 27, character: 76 } }, document);
        expect(cursorInfo.type).toEqual(Token.Content);
        expect(cursorInfo.tag).toEqual('strong');
    });
});

describe('findDynamicContent', () => {
    const text: string = '{foobar}, {foo.bar} so\nmething {baz.bux}';

    it('returns the dynamic match at the given offset if it exists', () => {
        expect(findDynamicContent(text, 5)).toEqual('foobar');
    });

    it('returns the match if its not the only one in the string', () => {
        expect(findDynamicContent(text, 12)).toEqual('foo');
    });

    it('returns null when not on dynamic content', () => {
        expect(findDynamicContent(text, 25)).toBeNull();
    });
});
