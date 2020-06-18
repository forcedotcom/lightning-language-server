import Server, { Token } from '../lwc-server';
import { TextDocuments, createConnection, TextDocument } from 'vscode-languageserver';
// import * as definition from '../definition';

import URI from 'vscode-uri';
import * as fsExtra from 'fs-extra';
import { getLanguageService } from 'vscode-html-languageservice';

const filename = '../../test-workspaces/sfdx-workspace/force-app/main/default/lwc/todo/todo.html';
const uri = URI.parse(filename).fsPath;
const document: TextDocument = TextDocument.create(uri, 'html', 0, fsExtra.readFileSync(filename).toString());

jest.mock('vscode-languageserver', () => {
    const actual = jest.requireActual('vscode-languageserver');
    return {
        ...actual,
        createConnection: jest.fn().mockImplementation(() => {
            return {
                onInitialize: () => true,
                onCompletion: () => true,
                onHover: () => true,
                onShutdown: () => true,
            };
        }),
        TextDocuments: jest.fn().mockImplementation(() => {
            return {
                listen: () => true,
                onDidChangeContent: () => true,
                get: () => [document],
            };
        }),
    };
});

describe('new', () => {
    const server: Server = new Server();
    server.languageService = getLanguageService();

    it('creates a new instance', () => {
        expect(server.connection);
        expect(server.documents);
    });

    describe('cursorInfo', () => {
        it('it knows when Im in a start tag', () => {
            const cursorInfo = server.cursorInfo({ textDocument: { uri }, position: { line: 16, character: 23 } }, document);
            expect(cursorInfo).toEqual({ type: Token.Tag, name: 'c-todo_item' });
        });

        it('knows when Im on an attribute name', () => {
            const cursorInfo = server.cursorInfo({ textDocument: { uri }, position: { line: 17, character: 26 } }, document);
            expect(cursorInfo).toEqual({ type: Token.Attribute, name: 'key', tag: 'c-todo_item' });
        });

        it('returns nothing if not recognized', () => {
            const cursorInfo = server.cursorInfo({ textDocument: { uri }, position: { line: 17, character: 33 } }, document);
            expect(cursorInfo).toBeNull();
        });
    });
});
