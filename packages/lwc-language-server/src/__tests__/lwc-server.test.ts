import Server from '../lwc-server';
import * as fsExtra from 'fs-extra';
import URI from 'vscode-uri';
import { getLanguageService, HTMLDocument } from 'vscode-html-languageservice';

import { WorkspaceFolder, TextDocuments, createConnection } from 'vscode-languageserver';

jest.mock('vscode-languageserver', () => {
    return {
        createConnection: jest.fn().mockImplementation(() => {
            return {
                onInitialize: () => true,
                onCompletion: () => true,
            };
        }),
        TextDocuments: jest.fn().mockImplementation(() => {
            return {
                listen: () => true,
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
