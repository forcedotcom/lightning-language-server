import * as path from 'path';
import * as fs from 'fs-extra';
import { shared } from '@salesforce/lightning-lsp-common';
import TSConfigPathIndexer from '../typescript/tsconfig-path-indexer';

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

describe('ComponentIndexer', () => {
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
        describe('#init', () => {
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
        });
    });
});
