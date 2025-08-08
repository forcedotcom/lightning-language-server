import ComponentIndexer from '../component-indexer';
import { ModuleExports, WireDecorator } from '@salesforce/lightning-lsp-common';
import { DataProviderAttributes, LWCDataProvider } from '../lwc-data-provider';
import Tag, { TagAttrs } from '../tag';
import * as path from 'path';

const workspaceRoot: string = path.resolve('../../test-workspaces/sfdx-workspace');
const componentIndexer: ComponentIndexer = new ComponentIndexer({
    workspaceRoot,
});
const attributes: DataProviderAttributes = {
    indexer: componentIndexer,
};
const provider = new LWCDataProvider(attributes);

beforeEach(async () => {
    await componentIndexer.init();
});

describe('provideValues()', () => {
    it('should return a list of values', () => {
        const values = provider.provideValues();
        const names = values.map((value) => value.name);
        expect(values).not.toBeEmpty();
        expect(names).toInclude('info');
        expect(names).toInclude('iconName');
    });

    it('should validate an empty array is returned when tag.classMembers is undefined', () => {
        // The setting of the TagAttrs's file property needs to be delayed. It needs to be undefined
        // when passed into the ctor(), and then we'll manually set it afterwards.
        const tagAttrs: TagAttrs = {
            file: undefined,
            metadata: {
                decorators: [] as WireDecorator[],
                exports: [] as ModuleExports[],
            },
            updatedAt: undefined,
        };
        const tag = new Tag(tagAttrs);
        tag.file = 'path/to/some-file';

        const componentIndexer = new ComponentIndexer({
            workspaceRoot,
        });
        componentIndexer.tags.set(tag.name, tag);

        const provider = new LWCDataProvider({
            indexer: componentIndexer,
        });

        const values = provider.provideValues();
        expect(values).toEqual([]);
    });
});

describe('provideAttributes()', () => {
    it('should return a set list of attributes for template tag', () => {
        const attributes = provider.provideAttributes('template');
        expect(attributes).not.toBeEmpty();
        expect(attributes).toBeArrayOfSize(9);
        expect(attributes[0].name).toEqual('for:each');
        expect(attributes[1].name).toEqual('for:item');
        expect(attributes[2].name).toEqual('for:index');
        expect(attributes[3].name).toEqual('if:true');
        expect(attributes[4].name).toEqual('if:false');
        expect(attributes[5].name).toEqual('lwc:if');
        expect(attributes[6].name).toEqual('lwc:elseif');
        expect(attributes[7].name).toEqual('lwc:else');
        expect(attributes[8].name).toEqual('iterator:it');
    });
});
