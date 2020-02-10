import { mockFileUtil } from './mock-file-util';
import { indexStaticResources } from '../static-resources-util';
import { validate } from './util';
// @ts-ignore
import { WorkspaceContext } from '@salesforce/lightning-lsp-common';

jest.mock('lightning-lsp-common', () => {
    const real = jest.requireActual('lightning-lsp-common');
    return { utils: mockFileUtil(), WorkspaceContext: real.WorkspaceContext };
});

it('indexStaticResources', async done => {
    // workspace with 1 package
    const expectedDTS = `declare module "@salesforce/resourceUrl/bike_assets" {
    var bike_assets: string;
    export default bike_assets;
}
declare module "@salesforce/resourceUrl/todocss" {
    var todocss: string;
    export default todocss;
}
`;
    await validate(indexStaticResources, 'sfdx-workspace', 'force-app', 'staticresources.d.ts', expectedDTS);

    // workspace with 2 packages
    const expectedDTS2 = `declare module "@salesforce/resourceUrl/bike_assets" {
    var bike_assets: string;
    export default bike_assets;
}
declare module "@salesforce/resourceUrl/todocss" {
    var todocss: string;
    export default todocss;
}
declare module "@salesforce/resourceUrl/todoutil" {
    var todoutil: string;
    export default todoutil;
}
`;
    await validate(indexStaticResources, 'sfdx-workspace', '{force-app,utils}', 'staticresources.d.ts', expectedDTS2);
    done();
});
