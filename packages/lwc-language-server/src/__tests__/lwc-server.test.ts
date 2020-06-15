import Server from '../lwc-server';

describe('new', () => {
    const server: Server = new Server();

    it('creates a new instance', () => {
        expect(server.connection).toBeUndefined();
        expect(server.documents).not.toBeNull();
        expect(server.languageService).not.toBeNull();
    });
});
