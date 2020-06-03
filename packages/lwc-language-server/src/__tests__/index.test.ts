import Index from '../index';
import * as path from 'path';

describe('new Index', () => {
    it('initializes with the root of a workspace', () => {
        const attributes = {
            workspaceRoot: 'test-workspace/sfdx-workspace',
            sfdxPackageDirsPattern: '{force-app, utils}',
        };
        const index: Index = new Index(attributes);
        const expectedPath: string = path.resolve('test-workspace/sfdx-workspace');

        expect(index.workspaceRoot).toEqual(expectedPath);
        expect(index.sfdxPackageDirsPattern).toEqual(attributes.sfdxPackageDirsPattern);
    });
});

describe('Index.metaFilePaths', () => {
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
});
