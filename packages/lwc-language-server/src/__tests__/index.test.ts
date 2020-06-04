import Index from '../index';
import * as path from 'path';
import * as fsExtra from 'fs-extra';

const index: Index = new Index({
    workspaceRoot: '../../test-workspaces/sfdx-workspace',
    sfdxPackageDirsPattern: '{force-app,utils}',
});

describe('Index', () => {
    afterEach(() => {
        fsExtra.removeSync(index.typingsBaseDir);
    });

    describe('new', () => {
        it('initializes with the root of a workspace', () => {
            const expectedPath: string = path.resolve('../../test-workspaces/sfdx-workspace');
            expect(index.workspaceRoot).toEqual(expectedPath);
            expect(index.sfdxPackageDirsPattern).toEqual('{force-app,utils}');
        });
    });

    describe('#createNewMetaTypings', () => {
        it('saves the meta files as t.ds files', async () => {
            index.createNewMetaTypings();
            const filepaths: string[] = ['Channel1.messageChannel.d.ts', 'bike_assets.resource.d.ts', 'logo.asset.d.ts', 'todocss.resource.d.ts'];

            filepaths.forEach(filepath => {
                filepath = path.join(index.typingsBaseDir, filepath);
                expect(fsExtra.pathExistsSync(filepath)).toBeTrue();
            });
        });
    });

    describe('#removeStaleTypings', () => {
        it('saves the meta files as t.ds files', async () => {
            const typing: string = path.join(index.typingsBaseDir, 'logo.resource.d.ts');
            const staleTyping: string = path.join(index.typingsBaseDir, 'extra.resource.d.ts');

            fsExtra.mkdirSync(index.typingsBaseDir);
            fsExtra.writeFileSync(typing, 'foobar');
            fsExtra.writeFileSync(staleTyping, 'foobar');

            index.deleteStaleMetaTypings();

            expect(fsExtra.pathExistsSync(typing)).toBeTrue();
            expect(fsExtra.pathExistsSync(staleTyping)).toBeFalse();
        });
    });

    describe('#saveCustomLabelTypings', () => {
        afterEach(() => {
            fsExtra.removeSync(index.typingsBaseDir);
        });

        it('saves the custom labels xml file to 1 typings file', async () => {
            await index.saveCustomLabelTypings();
            const customLabelPath: string = path.join(index.workspaceRoot, '.sfdx/typings/lwc/customlabels.d.ts');

            expect(fsExtra.pathExistsSync(customLabelPath)).toBeTrue();
            expect(fsExtra.readFileSync(customLabelPath).toString()).toInclude('declare module');
        });
    });

    describe('#metaFilePaths', () => {
        test('it returns all the paths  for meta files', () => {
            const metaFilePaths: string[] = index.metaFiles;
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
    });

    describe('#metaTypings', () => {
        test('it returns all the paths for meta files\' typings', () => {
            fsExtra.mkdirSync(path.join(index.typingsBaseDir, 'staticresources'), { recursive: true });
            fsExtra.mkdirSync(path.join(index.typingsBaseDir, 'messageChannels'), { recursive: true });
            fsExtra.mkdirSync(path.join(index.typingsBaseDir, 'contentassets'), { recursive: true });

            const expectedMetaFileTypingPaths: string[] = [
                '.sfdx/typings/lwc/logo.asset.d.ts',
                '.sfdx/typings/lwc/Channel1.messageChannel.d.ts',
                '.sfdx/typings/lwc/bike_assets.resource.d.ts',
                '.sfdx/typings/lwc/todocss.resource.d.ts',
            ];

            expectedMetaFileTypingPaths.forEach((filePath: string) => {
                filePath = path.join(index.workspaceRoot, filePath);
                fsExtra.writeFileSync(filePath, 'foobar');
            });

            const metaFilePaths: string[] = index.metaTypings;

            expectedMetaFileTypingPaths.forEach(expectedPath => {
                expect(metaFilePaths).toContain(expectedPath);
            });
        });
    });

    describe('.diff', () => {
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
                '.sfdx/typings/lwc/Channel1.messageChannel.d.ts',
                '.sfdx/typings/lwc/bike_assets.resource.d.ts',
                '.sfdx/typings/lwc/logo.resource.d.ts',
                '.sfdx/typings/lwc/todocss.resource.d.ts',
                '.sfdx/typings/lwc/foobar.resource.d.ts',
            ];

            expect(Index.diff(list1, list2)).toEqual([
                'force-app/main/default/messageChannels/Channel2.messageChannel-meta.xml',
                'utils/meta/staticresources/todoutil.resource-meta.xml',
            ]);

            expect(Index.diff(list2, list1)).toEqual(['.sfdx/typings/lwc/foobar.resource.d.ts']);
        });
    });
});
