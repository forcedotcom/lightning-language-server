import { mockFileUtil } from './mock-file-util';
import { indexContentAssets } from '../content-assets-util';
import { validate } from './util';

jest.mock('lightning-lsp-common', () => {
    return { utils: mockFileUtil() };
});

it('indexContentAssets', async done => {
    const expectedDTS = `declare module "@salesforce/contentAssetUrl/logo" {
    var logo: string;
    export default logo;
}
`;
    await validate(indexContentAssets, 'sfdx-workspace', 'force-app', 'contentassets.d.ts', expectedDTS);
    done();
});
