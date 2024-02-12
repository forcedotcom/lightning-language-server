import * as path from 'path';
import * as fs from 'fs-extra';
import { shared } from '@salesforce/lightning-lsp-common';
import { readAsTextDocument } from './test-utils';
import TSConfigPathIndexer from '../typescript/tsconfig-path-indexer';
import { collectImportsForDocument } from '../typescript/imports';
import { TextDocument } from 'vscode-languageserver-textdocument';

const { WorkspaceType } = shared;
const TEST_WORKSPACE_PARENT_DIR = path.resolve('../..');
const CORE_ROOT = path.join(TEST_WORKSPACE_PARENT_DIR, 'test-workspaces', 'core-like-workspace', 'coreTS', 'core');

const tsConfigForce = path.join(CORE_ROOT, 'ui-force-components', 'tsconfig.json');
const tsConfigGlobal = path.join(CORE_ROOT, 'ui-global-components', 'tsconfig.json');

function readTSConfigFile(tsconfigPath: string): object {
    if (!fs.pathExistsSync(tsconfigPath)) {
        return null;
    }
    return JSON.parse(fs.readFileSync(tsconfigPath, 'utf8'));
}

function restoreTSConfigFiles(): void {
    const tsconfig = {
        extends: '../tsconfig.json',
        compilerOptions: {
            paths: {},
        },
    };
    const tsconfigPaths = [tsConfigForce, tsConfigGlobal];
    for (const tsconfigPath of tsconfigPaths) {
        fs.writeJSONSync(tsconfigPath, tsconfig, {
            spaces: 4,
        });
    }
}

beforeEach(async () => {
    restoreTSConfigFiles();
});

afterEach(() => {
    jest.restoreAllMocks();
    restoreTSConfigFiles();
});

describe('TSConfigPathIndexer', () => {
    describe('new', () => {
        it('initializes with the root of a core root dir', () => {
            const expectedPath: string = path.resolve('../../test-workspaces/core-like-workspace/coreTS/core');
            const tsconfigPathIndexer = new TSConfigPathIndexer([CORE_ROOT]);
            expect(tsconfigPathIndexer.coreModulesWithTSConfig.length).toEqual(2);
            expect(tsconfigPathIndexer.coreModulesWithTSConfig[0]).toEqual(path.join(expectedPath, 'ui-force-components'));
            expect(tsconfigPathIndexer.coreModulesWithTSConfig[1]).toEqual(path.join(expectedPath, 'ui-global-components'));
            expect(tsconfigPathIndexer.workspaceType).toEqual(WorkspaceType.CORE_ALL);
            expect(tsconfigPathIndexer.coreRoot).toEqual(expectedPath);
        });

        it('initializes with the root of a core project dir', () => {
            const expectedPath: string = path.resolve('../../test-workspaces/core-like-workspace/coreTS/core');
            const tsconfigPathIndexer = new TSConfigPathIndexer([path.join(CORE_ROOT, 'ui-force-components')]);
            expect(tsconfigPathIndexer.coreModulesWithTSConfig.length).toEqual(1);
            expect(tsconfigPathIndexer.coreModulesWithTSConfig[0]).toEqual(path.join(expectedPath, 'ui-force-components'));
            expect(tsconfigPathIndexer.workspaceType).toEqual(WorkspaceType.CORE_PARTIAL);
            expect(tsconfigPathIndexer.coreRoot).toEqual(expectedPath);
        });
    });

    describe('instance methods', () => {
        describe('init', () => {
            it('no-op on sfdx workspace root', async () => {
                const tsconfigPathIndexer = new TSConfigPathIndexer([path.join(TEST_WORKSPACE_PARENT_DIR, 'test-workspaces', 'sfdx-workspace')]);
                const spy = jest.spyOn(tsconfigPathIndexer, 'componentEntries', 'get');
                await tsconfigPathIndexer.init();
                expect(spy).not.toHaveBeenCalled();
                expect(tsconfigPathIndexer.coreRoot).toBeUndefined();
            });

            it('generates paths mappings for all modules on core', async () => {
                const tsconfigPathIndexer = new TSConfigPathIndexer([CORE_ROOT]);
                await tsconfigPathIndexer.init();
                const tsConfigForceObj = readTSConfigFile(tsConfigForce);
                expect(tsConfigForceObj).toEqual({
                    extends: '../tsconfig.json',
                    compilerOptions: {
                        paths: {
                            'clients/context-library-lwc': ['./modules/clients/context-library-lwc/context-library-lwc'],
                            'force/input-phone': ['./modules/force/input-phone/input-phone'],
                        },
                    },
                });
                const tsConfigGlobalObj = readTSConfigFile(tsConfigGlobal);
                expect(tsConfigGlobalObj).toEqual({
                    extends: '../tsconfig.json',
                    compilerOptions: {
                        paths: {
                            'one/app-nav-bar': ['./modules/one/app-nav-bar/app-nav-bar'],
                        },
                    },
                });
            });

            it('removes paths mapping for deleted module on core', async () => {
                const oldTSConfig = {
                    extends: '../tsconfig.json',
                    compilerOptions: {
                        paths: {
                            'force/deleted': './modules/force/deleted/deleted',
                        },
                    },
                };
                fs.writeJSONSync(tsConfigForce, oldTSConfig, {
                    spaces: 4,
                });
                const tsconfigPathIndexer = new TSConfigPathIndexer([CORE_ROOT]);
                await tsconfigPathIndexer.init();
                const tsConfigForceObj = readTSConfigFile(tsConfigForce);
                expect(tsConfigForceObj).toEqual({
                    extends: '../tsconfig.json',
                    compilerOptions: {
                        paths: {
                            'clients/context-library-lwc': ['./modules/clients/context-library-lwc/context-library-lwc'],
                            'force/input-phone': ['./modules/force/input-phone/input-phone'],
                        },
                    },
                });
            });
        });

        describe('updateTSConfigFileForDocument', () => {
            it('no-op on sfdx workspace root', async () => {
                const tsconfigPathIndexer = new TSConfigPathIndexer([path.join(TEST_WORKSPACE_PARENT_DIR, 'test-workspaces', 'sfdx-workspace')]);
                await tsconfigPathIndexer.init();
                const filePath = path.join(CORE_ROOT, 'ui-force-components', 'modules', 'force', 'input-phone', 'input-phone.ts');
                const spy = jest.spyOn(tsconfigPathIndexer as any, 'addNewPathMapping');
                await tsconfigPathIndexer.updateTSConfigFileForDocument(readAsTextDocument(filePath));
                expect(spy).not.toHaveBeenCalled();
                expect(tsconfigPathIndexer.coreRoot).toBeUndefined();
            });

            it('updates tsconfig for all imports', async () => {
                const tsconfigPathIndexer = new TSConfigPathIndexer([CORE_ROOT]);
                await tsconfigPathIndexer.init();
                const filePath = path.join(CORE_ROOT, 'ui-force-components', 'modules', 'force', 'input-phone', 'input-phone.ts');
                await tsconfigPathIndexer.updateTSConfigFileForDocument(readAsTextDocument(filePath));
                const tsConfigForceObj = readTSConfigFile(tsConfigForce);
                expect(tsConfigForceObj).toEqual({
                    extends: '../tsconfig.json',
                    compilerOptions: {
                        paths: {
                            'one/app-nav-bar': ['../ui-global-components/modules/one/app-nav-bar/app-nav-bar'],
                            'clients/context-library-lwc': ['./modules/clients/context-library-lwc/context-library-lwc'],
                            'force/input-phone': ['./modules/force/input-phone/input-phone'],
                        },
                    },
                });
            });
        });
    });
});

function createTextDocumentFromString(content: string): TextDocument {
    return TextDocument.create('mockUri', 'typescript', 0, content);
}

describe('imports', () => {
    describe('collectImportsForDocument', () => {
        it('should exclude special imports', async () => {
            const document = createTextDocumentFromString(`
                import {api} from 'lwc';
                import {obj1} from './abc';
                import {obj2} from '../xyz';
                import {obj3} from 'lightning/confirm';
                import {obj4} from '@salesforce/label/x';
                import {obj5} from 'x.html';
                import {obj6} from 'y.css';
                import {obj7} from 'namespace/cmpName';
            `);
            const imports = await collectImportsForDocument(document);
            expect(imports.size).toEqual(1);
            expect(imports.has('namespace/cmpName'));
        });

        it('should work for partial file content', async () => {
            const document = createTextDocumentFromString(`
                import from
            `);
            const imports = await collectImportsForDocument(document);
            expect(imports.size).toEqual(0);
        });

        it('dynamic imports', async () => {
            const document = createTextDocumentFromString(`
                const {
                    default: myDefault,
                    foo,
                    bar,
                } = await import("force/wireUtils");
            `);
            const imports = await collectImportsForDocument(document);
            expect(imports.size).toEqual(1);
            expect(imports.has('force/wireUtils'));
        });
    });
});
