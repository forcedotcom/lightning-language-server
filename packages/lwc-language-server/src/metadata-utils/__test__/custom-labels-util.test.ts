import { mockFileUtil } from './mock-file-util';
import { indexCustomLabels } from '../custom-labels-util';
import { validate } from './util';

jest.mock('../file-flush-util', () => {
    return mockFileUtil();
});

it('indexCustomLabels', async done => {
    // workspace with one package
    const expectedDTS = `declare module "@label/c.greeting" {
    var labelName: string;
    export default labelName;
}
declare module "@label/c.greeting2" {
    var labelName: string;
    export default labelName;
}
`;
    await validate(indexCustomLabels, 'sfdx-workspace', 'force-app', 'customlabels.d.ts', expectedDTS);

    // workspace with 2 packages
    const expectedDTS2 = `declare module "@label/c.greeting" {
    var labelName: string;
    export default labelName;
}
declare module "@label/c.greeting2" {
    var labelName: string;
    export default labelName;
}
declare module "@label/c.utils" {
    var labelName: string;
    export default labelName;
}
`;
    await validate(indexCustomLabels, 'sfdx-workspace', '{force-app,utils}', 'customlabels.d.ts', expectedDTS2);
    done();
});
