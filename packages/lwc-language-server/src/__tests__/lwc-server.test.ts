// import { WorkspaceFolder, TextDocument } from 'vscode-languageserver';

// import Server from '../lwc-server';
// import * as fsExtra from 'fs-extra';
// import URI from 'vscode-uri';
// import { getLanguageService, HTMLDocument } from 'vscode-html-languageservice';

// describe('new', () => {
//     const workspaceFolder: WorkspaceFolder = {
//         uri: '../../test-workspaces/sfdx-workspace',
//         name: 'sfdx-workspace',
//     };

//     const filename = '../../test-workspaces/sfdx-workspace/force-app/main/default/lwc/todo/todo.html';
//     const uri = URI.parse(filename).fsPath;
//     const server: Server = new Server([workspaceFolder]);
//     const document: TextDocument = TextDocument.create(uri, 'html', 0, fsExtra.readFileSync(filename).toString());
//     const languageService = getLanguageService();
//     const htmlDoc: HTMLDocument = languageService.parseHTMLDocument(document);

//     it('creates a new instance', () => {
//         expect(server.workspaceRoots);
//         expect(server.componentIndexer);
//     });

//     describe('Instance methods', () => {
//         // describe('#offsetOnElementTag', () => {
//         //     it('returns true when the position is on the opening tag', () => {
//         //         const params = {
//         //             htmlDoc,
//         //             document,
//         //             offset: 680,
//         //         };
//         //         expect(server.offsetOnElementTag(params)).toBeTrue();
//         //     });
//         // });
//         // describe('#definitionQuery', () => {
//         //     it('returns the location of a tag when cursor is over the node tag', () => {
//         //         const params = {
//         //             textDocument: { uri },
//         //             position: { line: 17, character: 25 }
//         //         }
//         //         server.definitionQuery(params, document)
//         //     });
//         // });
//     });
// });
