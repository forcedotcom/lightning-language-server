import Server, { Token, findDynamicContent } from '../lwc-server';
import { TextDocument, InitializeParams, TextDocumentPositionParams, Location } from 'vscode-languageserver';
import { getLanguageService } from 'vscode-html-languageservice';

import URI from 'vscode-uri';
import * as fsExtra from 'fs-extra';
import * as path from 'path';

const filename = path.resolve('../../test-workspaces/sfdx-workspace/force-app/main/default/lwc/todo/todo.html');
const uri = URI.parse(filename).fsPath;
const document: TextDocument = TextDocument.create(uri, 'html', 0, fsExtra.readFileSync(filename).toString());

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
                get: () => document,
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
                uri: path.resolve('../../test-workspaces/sfdx-workspace/'),
                name: path.resolve('../../test-workspaces/sfdx-workspace/'),
            },
        ],
    };

    describe('#onCompletion', () => {
        it('returns a list of available completion items', async () => {
            const params: TextDocumentPositionParams = {
                textDocument: { uri: filename },
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
            expect(labels).toInclude('div'); // also includes normal html tags
        });
    });

    describe('#onDefinition', () => {
        it('returns the Location of the html tags corresponding .js file', async () => {
            const params: TextDocumentPositionParams = {
                textDocument: { uri: filename },
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
                textDocument: { uri: filename },
                position: {
                    line: 19,
                    character: 40,
                },
            };

            await server.onInitialize(initializeParams);
            await server.componentIndexer.init();
            const [location] = server.onDefinition(params);
            expect(location.uri).toContain('todo/todo.js');
            expect(location.range.start.line).toEqual(103);
            expect(location.range.start.character).toEqual(4);
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
