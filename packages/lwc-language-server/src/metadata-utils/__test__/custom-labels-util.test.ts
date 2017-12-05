import { mockFileUtil } from './mock-file-util';
import { indexCustomLabels } from '../custom-labels-util';
import { validate } from './util';

jest.mock('../file-flush-util', () => {
    return mockFileUtil();
});

it('fush test', async (done) => {
    const expectedDTS =
`declare module "@label/c.greeting" {
    var labelName: string;
    export default labelName;
}
declare module "@label/c.greeting2" {
    var labelName: string;
    export default labelName;
}
`;
    validate(indexCustomLabels, 'test-force-app-metadata', 'customlabels.d.ts', expectedDTS, done);
});
