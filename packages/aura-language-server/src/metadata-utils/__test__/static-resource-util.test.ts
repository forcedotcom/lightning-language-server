import { mockFileUtil } from './mock-file-util';
import { indexStaticResources } from '../static-resources-util';
import { validate } from './util';

jest.mock('../../utils', () => {
    return mockFileUtil();
});

it('indexStaticResources', async done => {
    // workspace with 1 package
    const expectedDTS = `declare module "@salesforce/resource-url/bike_assets" {
    var bike_assets: string;
    export default bike_assets;
}
declare module "@salesforce/resource-url/todocss" {
    var todocss: string;
    export default todocss;
}
`;
    await validate(indexStaticResources, 'sfdx-workspace', 'force-app', 'staticresources.d.ts', expectedDTS);

    // workspace with 2 packages
    const expectedDTS2 = `declare module "@salesforce/resource-url/bike_assets" {
    var bike_assets: string;
    export default bike_assets;
}
declare module "@salesforce/resource-url/todocss" {
    var todocss: string;
    export default todocss;
}
declare module "@salesforce/resource-url/todoutil" {
    var todoutil: string;
    export default todoutil;
}
`;
    await validate(indexStaticResources, 'sfdx-workspace', '{force-app,utils}', 'staticresources.d.ts', expectedDTS2);
    done();
});
