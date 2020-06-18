import Server from '../lwc-server';
import { TextDocuments, createConnection } from 'vscode-languageserver';

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
            };
        }),
    };
});

describe('new', () => {
    const server: Server = new Server();

    it('creates a new instance', () => {
        expect(server.connection);
        expect(server.documents);
    });
});
