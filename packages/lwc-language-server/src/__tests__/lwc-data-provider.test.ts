import ComponentIndexer from '../component-indexer';
import * as path from 'path';
import { LWCDataProvider, DataProviderAttributes } from '../lwc-data-provider';

const workspaceRoot: string = path.resolve('../../test-workspaces/sfdx-workspace');
const componentIndexer: ComponentIndexer = new ComponentIndexer({
    workspaceRoot,
});
const attributes: DataProviderAttributes = {
    indexer: componentIndexer,
};
const provider = new LWCDataProvider(attributes);

beforeEach(async done => {
    await componentIndexer.init();
    done();
});

describe('provideValues()', () => {
    it('should return a list of values', () => {
        const values = provider.provideValues();
        const names = values.map(value => value.name);
        expect(values).not.toBeEmpty();
        expect(names).toInclude('info');
        expect(names).toInclude('iconName');
    });
});

describe('provideAttributes()', () => {
    it('should return a set list of attributes for template tag', () => {
        const attributes = provider.provideAttributes('template');
        expect(attributes).not.toBeEmpty();
        expect(attributes).toBeArrayOfSize(6);
        expect(attributes[0].name).toEqual('for:each');
        expect(attributes[1].name).toEqual('for:item');
        expect(attributes[2].name).toEqual('for:index');
        expect(attributes[3].name).toEqual('if:true');
        expect(attributes[4].name).toEqual('if:false');
        expect(attributes[5].name).toEqual('iterator:it');
    });
});
