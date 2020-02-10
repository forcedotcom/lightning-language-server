import { mockFileUtil } from './mock-file-util';
import { indexContentAssets } from '../content-assets-util';
import { validate } from './util';
// @ts-ignore
import { WorkspaceContext } from '@salesforce/lightning-lsp-common';

jest.mock('@salesforce/lightning-lsp-common', () => {
    const real = jest.requireActual('@salesforce/lightning-lsp-common');
    return { utils: mockFileUtil(), WorkspaceContext: real.WorkspaceContext };
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
