import Server, { Token, findDynamicContent } from '../lwc-server';
import { getLanguageService } from 'vscode-html-languageservice';
import {
    TextDocument,
    InitializeParams,
    TextDocumentPositionParams,
    Location,
    MarkupContent,
    Hover,
    CompletionParams,
    CompletionTriggerKind,
    DidChangeWatchedFilesParams,
    FileChangeType,
} from 'vscode-languageserver';

import { URI } from 'vscode-uri';
import { sync } from 'fast-glob';
import * as fsExtra from 'fs-extra';
import * as path from 'path';

const SFDX_WORKSPACE_ROOT = '../../test-workspaces/sfdx-workspace';
const filename = path.resolve(SFDX_WORKSPACE_ROOT + '/force-app/main/default/lwc/todo/todo.html');
const uri = URI.file(filename).toString();
const document: TextDocument = TextDocument.create(uri, 'html', 0, fsExtra.readFileSync(filename).toString());

const jsFilename = path.resolve(SFDX_WORKSPACE_ROOT + '/force-app/main/default/lwc/todo/todo.js');
const jsUri = URI.file(jsFilename).toString();
const jsDocument: TextDocument = TextDocument.create(uri, 'javascript', 0, fsExtra.readFileSync(jsFilename).toString());

const auraFilename = path.resolve(SFDX_WORKSPACE_ROOT + '/force-app/main/default/aura/todoApp/todoApp.app');
const auraUri = URI.file(auraFilename).toString();
const auraDocument: TextDocument = TextDocument.create(auraFilename, 'html', 0, fsExtra.readFileSync(auraFilename).toString());

const hoverFilename = path.resolve(SFDX_WORKSPACE_ROOT + '/force-app/main/default/lwc/lightning_tree_example/lightning_tree_example.html');
const hoverUri = URI.file(hoverFilename).toString();
const hoverDocument: TextDocument = TextDocument.create(hoverFilename, 'html', 0, fsExtra.readFileSync(hoverFilename).toString());

const server: Server = new Server();

let mockTypeScriptSupportConfig = false;

jest.mock('vscode-languageserver', () => {
    const actual = jest.requireActual('vscode-languageserver');
    return {
        ...actual,
        createConnection: jest.fn().mockImplementation(() => {
            return {
                onInitialize: (): boolean => true,
                onInitialized: (): boolean => true,
                onCompletion: (): boolean => true,
                onCompletionResolve: (): boolean => true,
                onDidChangeWatchedFiles: (): boolean => true,
                onHover: (): boolean => true,
                onShutdown: (): boolean => true,
                onDefinition: (): boolean => true,
                workspace: {
                    getConfiguration: (): boolean => mockTypeScriptSupportConfig,
                },
            };
        }),
        TextDocuments: jest.fn().mockImplementation(() => {
            return {
                listen: (): boolean => true,
                onDidChangeContent: (): boolean => true,
                get: (name: string): TextDocument => {
                    const docs = new Map([
                        [uri, document],
                        [jsUri, jsDocument],
                        [auraUri, auraDocument],
                        [hoverUri, hoverDocument],
                    ]);
                    return docs.get(name);
                },
                onDidSave: (): boolean => true,
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
                uri: URI.file(path.resolve(SFDX_WORKSPACE_ROOT)).toString(),
                name: path.resolve(SFDX_WORKSPACE_ROOT),
            },
        ],
    };

    describe('#onCompletion', () => {
        it('should return a list of available completion items in a javascript file', async () => {
            const params: CompletionParams = {
                textDocument: { uri: jsUri },
                position: {
                    line: 0,
                    character: 0,
                },
                context: {
                    triggerCharacter: '.',
                    triggerKind: CompletionTriggerKind.TriggerCharacter,
                },
            };

            await server.onInitialize(initializeParams);
            const completions = await server.onCompletion(params);
            const labels = completions.items.map(item => item.label);
            expect(labels).toBeArrayOfSize(8);
            expect(labels).toInclude('c/todo_util');
            expect(labels).toInclude('c/todo_item');
        });

        it('should not return a list of completion items in a javascript file for open curly brace', async () => {
            const params: CompletionParams = {
                textDocument: { uri: jsUri },
                position: {
                    line: 0,
                    character: 0,
                },
                context: {
                    triggerCharacter: '{',
                    triggerKind: CompletionTriggerKind.TriggerCharacter,
                },
            };

            await server.onInitialize(initializeParams);
            const completions = await server.onCompletion(params);
            expect(completions).toBeUndefined();
        });

        it('returns a list of available tag completion items in a LWC template', async () => {
            const params: CompletionParams = {
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

        it('should return a list of available attribute completion items in a LWC template', async () => {
            const params: CompletionParams = {
                textDocument: { uri },
                position: {
                    line: 0,
                    character: 0,
                },
                context: {
                    triggerCharacter: '{',
                    triggerKind: CompletionTriggerKind.TriggerCharacter,
                },
            };

            await server.onInitialize(initializeParams);
            const completions = await server.onCompletion(params);
            const labels = completions.items.map(item => item.label);
            expect(labels).toBeArrayOfSize(21);
            expect(labels).toInclude('handleToggleAll');
            expect(labels).toInclude('handleClearCompleted');
        });

        it('should still return a list of completion items inside the curly brace without the trigger character in a LWC template', async () => {
            const params: CompletionParams = {
                textDocument: { uri },
                position: {
                    line: 44,
                    character: 22,
                },
            };

            await server.onInitialize(initializeParams);
            const completions = await server.onCompletion(params);
            const labels = completions.items.map(item => item.label);
            expect(labels).toInclude('handleToggleAll');
            expect(labels).toInclude('handleClearCompleted');
            expect(labels).toInclude('has5Todos_today');
            expect(labels).toInclude('$has5Todos_today');
        });

        it('returns a list of available completion items in a Aura template', async () => {
            const params: CompletionParams = {
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
        it('returns the docs for that hovered item', async () => {
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

        it('should return the component library link for a standard component', async () => {
            const params: TextDocumentPositionParams = {
                textDocument: { uri: hoverUri },
                position: {
                    line: 1,
                    character: 11,
                },
            };

            await server.onInitialize(initializeParams);
            await server.componentIndexer.init();
            const hover: Hover = await server.onHover(params);
            const contents = hover.contents as MarkupContent;
            expect(contents.value).toContain('https://developer.salesforce.com/docs/component-library/bundle/lightning-tree');
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
            expect(location.uri).toContain('todo/todo.js');
            expect(location.range.start.line).toEqual(105);
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

    describe('onInitialized()', () => {
        const baseTsconfigPath = SFDX_WORKSPACE_ROOT + '/.sfdx/tsconfig.sfdx.json';
        const getTsConfigPaths = (): string[] => sync(SFDX_WORKSPACE_ROOT + '/**/lwc/tsconfig.json');

        afterEach(async () => {
            // Clean up after each test run
            fsExtra.removeSync(baseTsconfigPath);
            const tsconfigPaths = getTsConfigPaths();
            tsconfigPaths.forEach(tsconfigPath => fsExtra.removeSync(tsconfigPath));
            mockTypeScriptSupportConfig = false;
        });

        it('skip tsconfig initialization when salesforcedx-vscode-lwc.preview.typeScriptSupport = false', async () => {
            await server.onInitialize(initializeParams);
            await server.onInitialized();

            expect(fsExtra.existsSync(baseTsconfigPath)).toBe(false);
            const tsconfigPaths = getTsConfigPaths();
            expect(tsconfigPaths.length).toBe(0);
        });

        it('initializes tsconfig when salesforcedx-vscode-lwc.preview.typeScriptSupport = true', async () => {
            // Enable feature flag
            mockTypeScriptSupportConfig = true;
            await server.onInitialize(initializeParams);
            await server.onInitialized();

            expect(fsExtra.existsSync(baseTsconfigPath)).toBe(true);
            const tsconfigPaths = getTsConfigPaths();
            // There are currently 3 lwc subdirectories under SFDX_WORKSPACE_ROOT
            expect(tsconfigPaths.length).toBe(3);
        });

        it('updates tsconfig.sfdx.json path mapping', async () => {
            // Enable feature flag
            mockTypeScriptSupportConfig = true;
            await server.onInitialize(initializeParams);
            await server.onInitialized();

            const sfdxTsConfig = fsExtra.readJsonSync(baseTsconfigPath);
            const pathMapping = Object.keys(sfdxTsConfig.compilerOptions.paths);
            expect(pathMapping.length).toEqual(11);
        });
    });

    describe('onDidChangeWatchedFiles', () => {
        const baseTsconfigPath = SFDX_WORKSPACE_ROOT + '/.sfdx/tsconfig.sfdx.json';
        const watchedFileDir = SFDX_WORKSPACE_ROOT + '/force-app/main/default/lwc/newlyAddedFile';

        const getPathMappingKeys = (): string[] => {
            const sfdxTsConfig = fsExtra.readJsonSync(baseTsconfigPath);
            return Object.keys(sfdxTsConfig.compilerOptions.paths);
        };

        beforeEach(() => {
            mockTypeScriptSupportConfig = true;
        });

        afterEach(() => {
            // Clean up after each test run
            fsExtra.removeSync(baseTsconfigPath);
            const tsconfigPaths = sync(SFDX_WORKSPACE_ROOT + '/**/lwc/tsconfig.json');
            tsconfigPaths.forEach(tsconfigPath => fsExtra.removeSync(tsconfigPath));
            fsExtra.removeSync(watchedFileDir);
            mockTypeScriptSupportConfig = false;
        });

        ['.js', '.ts'].forEach(ext => {
            it(`updates tsconfig.sfdx.json path mapping when ${ext} file created`, async () => {
                // Enable feature flag
                mockTypeScriptSupportConfig = true;
                await server.onInitialize(initializeParams);
                await server.onInitialized();

                const initializedPathMapping = getPathMappingKeys();
                expect(initializedPathMapping.length).toEqual(11);

                // Create files after initialized
                const watchedFilePath = path.resolve(watchedFileDir, `newlyAddedFile${ext}`);
                fsExtra.createFileSync(watchedFilePath);

                const didChangeWatchedFilesParams: DidChangeWatchedFilesParams = {
                    changes: [
                        {
                            uri: watchedFilePath,
                            type: FileChangeType.Created,
                        },
                    ],
                };

                await server.onDidChangeWatchedFiles(didChangeWatchedFilesParams);
                const pathMapping = getPathMappingKeys();
                // Path mapping updated
                expect(pathMapping.length).toEqual(12);
            });

            it(`removes tsconfig.sfdx.json path mapping when ${ext} files deleted`, async () => {
                // Create files before initialized
                const watchedFilePath = path.resolve(watchedFileDir, `newlyAddedFile${ext}`);
                fsExtra.createFileSync(watchedFilePath);

                await server.onInitialize(initializeParams);
                await server.onInitialized();

                const initializedPathMapping = getPathMappingKeys();
                expect(initializedPathMapping.length).toEqual(12);

                fsExtra.removeSync(watchedFilePath);

                const didChangeWatchedFilesParams: DidChangeWatchedFilesParams = {
                    changes: [
                        {
                            uri: watchedFilePath,
                            type: FileChangeType.Deleted,
                        },
                    ],
                };

                await server.onDidChangeWatchedFiles(didChangeWatchedFilesParams);
                const updatedPathMapping = getPathMappingKeys();
                expect(updatedPathMapping.length).toEqual(11);
            });

            it(`no updates to tsconfig.sfdx.json path mapping when ${ext} files changed`, async () => {
                // Create files before initialized
                const watchedFilePath = path.resolve(watchedFileDir, `newlyAddedFile${ext}`);
                fsExtra.createFileSync(watchedFilePath);

                await server.onInitialize(initializeParams);
                await server.onInitialized();

                const initializedPathMapping = getPathMappingKeys();
                expect(initializedPathMapping.length).toEqual(12);

                fsExtra.removeSync(watchedFilePath);

                const didChangeWatchedFilesParams: DidChangeWatchedFilesParams = {
                    changes: [
                        {
                            uri: watchedFilePath,
                            type: FileChangeType.Changed,
                        },
                    ],
                };

                await server.onDidChangeWatchedFiles(didChangeWatchedFilesParams);
                const updatedPathMapping = getPathMappingKeys();
                expect(updatedPathMapping.length).toEqual(12);
            });

            it(`doesn't update path mapping when parent directory is not lwc`, async () => {
                await server.onInitialize(initializeParams);
                await server.onInitialized();

                const initializedPathMapping = getPathMappingKeys();
                expect(initializedPathMapping.length).toEqual(11);

                const watchedFilePath = path.resolve(watchedFileDir, '__tests__', 'newlyAddedFile', `newlyAddedFile${ext}`);
                fsExtra.createFileSync(watchedFilePath);

                const didChangeWatchedFilesParams: DidChangeWatchedFilesParams = {
                    changes: [
                        {
                            uri: watchedFilePath,
                            type: FileChangeType.Created,
                        },
                    ],
                };

                await server.onDidChangeWatchedFiles(didChangeWatchedFilesParams);
                const updatedPathMapping = getPathMappingKeys();
                expect(updatedPathMapping.length).toEqual(11);
            });
        });

        ['.html', '.css', '.js-meta.xml', '.txt'].forEach(ext => {
            [FileChangeType.Created, FileChangeType.Changed, FileChangeType.Deleted].forEach(type => {
                it(`no path mapping updates made for ${ext} on ${type} event`, async () => {
                    const lwcComponentPath = path.resolve(watchedFileDir, `newlyAddedFile.ts`);
                    const nonJsOrTsFilePath = path.resolve(watchedFileDir, `newlyAddedFile${ext}`);
                    fsExtra.createFileSync(lwcComponentPath);
                    fsExtra.createFileSync(nonJsOrTsFilePath);

                    await server.onInitialize(initializeParams);
                    await server.onInitialized();

                    const initializedPathMapping = getPathMappingKeys();
                    expect(initializedPathMapping.length).toEqual(12);

                    fsExtra.removeSync(nonJsOrTsFilePath);

                    const didChangeWatchedFilesParams: DidChangeWatchedFilesParams = {
                        changes: [
                            {
                                uri: nonJsOrTsFilePath,
                                type: type as FileChangeType,
                            },
                        ],
                    };

                    await server.onDidChangeWatchedFiles(didChangeWatchedFilesParams);
                    const updatedPathMapping = getPathMappingKeys();
                    expect(updatedPathMapping.length).toEqual(12);
                });
            });
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
                    triggerCharacters: ['.', '-', '_', '<', '"', '=', '/', '>', '{'],
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
    const text = '{foobar}, {foo.bar} so\nmething {baz.bux}';

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

describe('Core All Workspace', () => {
    const initializeParams: InitializeParams = {
        processId: 0,
        rootUri: '',
        capabilities: {},
        workspaceFolders: [
            {
                uri: URI.file(path.resolve('../../test-workspaces/core-like-workspace/app/main/core')).toString(),
                name: path.resolve('../../test-workspaces/sfdx-workspace/'),
            },
        ],
    };

    it('Should not throw during intialization', async () => {
        await server.onInitialize(initializeParams);
    });
});

describe('Core Partial Workspace', () => {
    const initializeParams: InitializeParams = {
        processId: 0,
        rootUri: '',
        capabilities: {},
        workspaceFolders: [
            {
                uri: URI.file(path.resolve('../../test-workspaces/core-like-workspace/app/main/core/ui-global-components')).toString(),
                name: path.resolve('../../test-workspaces/sfdx-workspace/'),
            },
        ],
    };

    it('Should not throw during intialization', async () => {
        await server.onInitialize(initializeParams);
    });
});
