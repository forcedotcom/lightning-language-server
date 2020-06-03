import Index from '../index';
import * as path from 'path';
import * as fsExtra from 'fs-extra';

describe('new Index', () => {
    it('initializes with the root of a workspace', () => {
        const attributes = {
            workspaceRoot: 'test-workspaces/sfdx-workspace',
            sfdxPackageDirsPattern: '{force-app, utils}',
        };
        const index: Index = new Index(attributes);
        const expectedPath: string = path.resolve('test-workspaces/sfdx-workspace');

        expect(index.workspaceRoot).toEqual(expectedPath);
        expect(index.sfdxPackageDirsPattern).toEqual(attributes.sfdxPackageDirsPattern);
    });
});

describe('Index#metaFilePaths', () => {
    test('it returns all the paths  for meta files', () => {
        const index: Index = new Index({
            workspaceRoot: '../../test-workspaces/sfdx-workspace',
            sfdxPackageDirsPattern: '{force-app,utils}',
        });
        const metaFilePaths: string[] = index.metaFilePaths();
        const expectedMetaFilePaths: string[] = [
            'force-app/main/default/contentassets/logo.asset-meta.xml',
            'force-app/main/default/messageChannels/Channel1.messageChannel-meta.xml',
            'force-app/main/default/messageChannels/Channel2.messageChannel-meta.xml',
            'force-app/main/default/staticresources/bike_assets.resource-meta.xml',
            'force-app/main/default/staticresources/todocss.resource-meta.xml',
            'utils/meta/staticresources/todoutil.resource-meta.xml',
        ];

        expect(metaFilePaths).toEqual(expectedMetaFilePaths);
    });

    describe('Index#metaFileTypingPaths', () => {
        const expectedMetaFileTypingPaths: string[] = [
            '.sfdx/typings/lwc/contentassets/logo.d.ts',
            '.sfdx/typings/lwc/messageChannels/Channel1.d.ts',
            '.sfdx/typings/lwc/staticresources/bike_assets.d.ts',
            '.sfdx/typings/lwc/staticresources/todocss.d.ts',
        ];
        const typingsDirs: string[] = ['.sfdx/typings/lwc/staticresources/', '.sfdx/typings/lwc/messageChannels/', '.sfdx/typings/lwc/contentassets/'];
        const workspaceRoot: string = '../../test-workspaces/sfdx-workspace';

        beforeEach(() => {
            typingsDirs.forEach(filepath => {
                fsExtra.mkdirSync(path.join(workspaceRoot, filepath), { recursive: true });
            });

            expectedMetaFileTypingPaths.forEach((filePath: string) => {
                filePath = path.join(workspaceRoot, filePath);
                fsExtra.writeFileSync(filePath, 'foobar');
            });
        });

        afterEach(() => {
            fsExtra.removeSync(path.join(workspaceRoot, '.sfdx/typings/lwc/'));
        });

        test('it returns all the paths for meta files\' typings', () => {
            const index: Index = new Index({
                workspaceRoot: '../../test-workspaces/sfdx-workspace',
                sfdxPackageDirsPattern: '{force-app,utils}',
            });

            const metaFilePaths: string[] = index.metaFileTypingPaths();
            expect(metaFilePaths).toEqual(expectedMetaFileTypingPaths);
        });
    });

    describe('Index.diff', () => {
        it('returns a list of strings that do not exist in the compare list', () => {
            const list1: string[] = [
                'force-app/main/default/contentassets/logo.asset-meta.xml',
                'force-app/main/default/messageChannels/Channel1.messageChannel-meta.xml',
                'force-app/main/default/messageChannels/Channel2.messageChannel-meta.xml',
                'force-app/main/default/staticresources/bike_assets.resource-meta.xml',
                'force-app/main/default/staticresources/todocss.resource-meta.xml',
                'utils/meta/staticresources/todoutil.resource-meta.xml',
            ];

            const list2: string[] = [
                '.sfdx/typings/lwc/messageChannels/Channel1.d.ts',
                '.sfdx/typings/lwc/staticresources/bike_assets.d.ts',
                '.sfdx/typings/lwc/staticresources/logo.d.ts',
                '.sfdx/typings/lwc/staticresources/todocss.d.ts',
                '.sfdx/typings/lwc/staticresources/foobar.d.ts',
            ];

            expect(Index.diff(list1, list2)).toEqual([
                'force-app/main/default/messageChannels/Channel2.messageChannel-meta.xml',
                'utils/meta/staticresources/todoutil.resource-meta.xml',
            ]);

            expect(Index.diff(list2, list1)).toEqual(['.sfdx/typings/lwc/staticresources/foobar.d.ts']);
        });
    });

    describe('Index#createNewMetaTypings', () => {
        it('saves the meta files as t.ds files', async () => {
            const index: Index = new Index({
                workspaceRoot: '../../test-workspaces/sfdx-workspace',
                sfdxPackageDirsPattern: '{force-app,utils}',
            });

            index.createNewMetaTypings();

            const filepaths: string[] = [
                'messageChannels/Channel1.d.ts',
                'staticresources/bike_assets.d.ts',
                'contentAssets/logo.d.ts',
                'staticresources/todocss.d.ts',
            ];
            filepaths.forEach(filepath => {
                filepath = path.join(index.workspaceRoot, index.typingsBaseDir(), filepath);
                expect(fsExtra.pathExistsSync(filepath)).toBeTrue();
            });

            fsExtra.removeSync('../../test-workspaces/sfdx-workspace/.sfdx/typings/lwc/');
        });
    });

    describe('Index#removeStaleTypings', () => {
        const metaFileTypingPath: string = '.sfdx/typings/lwc/staticresources/logo.d.ts';
        const staleMetaFileTypingPath: string = '.sfdx/typings/lwc/staticresources/extra.d.ts';
        const typingDir: string = '.sfdx/typings/lwc/staticresources/';
        const workspaceRoot: string = '../../test-workspaces/sfdx-workspace';

        beforeEach(() => {
            fsExtra.removeSync(path.join(workspaceRoot, '.sfdx/typings/lwc/'));
            fsExtra.mkdirSync(path.join(workspaceRoot, typingDir), { recursive: true });

            [metaFileTypingPath, staleMetaFileTypingPath].forEach((filePath: string) => {
                filePath = path.join(workspaceRoot, filePath);
                fsExtra.writeFileSync(filePath, 'foobar');
            });
        });

        afterEach(() => {
            fsExtra.removeSync('../../test-workspaces/sfdx-workspace/.sfdx/typings/lwc/');
        });

        it('saves the meta files as t.ds files', async () => {
            const index: Index = new Index({
                workspaceRoot: '../../test-workspaces/sfdx-workspace',
                sfdxPackageDirsPattern: '{force-app,utils}',
            });

            index.deleteStaleMetaTypings();

            const typing = path.join(index.workspaceRoot, metaFileTypingPath);
            const staleTyping = path.join(index.workspaceRoot, staleMetaFileTypingPath);

            expect(fsExtra.pathExistsSync(typing)).toBeTrue();
            expect(fsExtra.pathExistsSync(staleTyping)).toBeFalse();
        });
    });
});
