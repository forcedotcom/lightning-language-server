import { mockFileUtil } from './mock-file-util';
import { indexStaticResources } from '../static-resources-util';
import { validate } from './util';

jest.mock('../file-flush-util', () => {
    return mockFileUtil();
});

it('indexStaticResources', async (done) => {
    const expectedDTS =
`declare module "@resource-url/todocss" {
    var resourceUrl: string;
    export default resourceUrl;
}
`;
    validate(indexStaticResources, 'sfdx-workspace', 'force-app', 'staticresources.d.ts', expectedDTS, done);
});
