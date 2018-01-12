import { mockFileUtil } from './mock-file-util';
import { indexStaticResources } from '../static-resources-util';
import { validate } from './util';

jest.mock('../file-flush-util', () => {
    return mockFileUtil();
});

it('indexStaticResources', async done => {
    // workspace with 1 package
    const expectedDTS = `declare module "@resource-url/todocss" {
    var resourceUrl: string;
    export default resourceUrl;
}
`;
    await validate(indexStaticResources, 'sfdx-workspace', 'force-app', 'staticresources.d.ts', expectedDTS, done);

    // workspace with 2 packages
    const expectedDTS2 = `declare module "@resource-url/todocss" {
    var resourceUrl: string;
    export default resourceUrl;
}
declare module "@resource-url/todoutil" {
    var resourceUrl: string;
    export default resourceUrl;
}
`;
    await validate(indexStaticResources, 'sfdx-workspace', '{force-app,utils}', 'staticresources.d.ts', expectedDTS2, done);
});
