import { mockFileUtil } from "./mock-file-util";
import { indexStaticResources } from "../static-resources-util";
import { validate } from "./util";

jest.mock('../file-flush-util', () => {
    return mockFileUtil();
});

it('fush test', async (done) => {
    const expectedDTS =
`declare module "@resource-url/todocss" {
    var resourceUrl: string;
    export default resourceUrl;
}
`;
    validate(indexStaticResources, "test-force-app-metadata", "staticresources.d.ts", expectedDTS, done);
});
