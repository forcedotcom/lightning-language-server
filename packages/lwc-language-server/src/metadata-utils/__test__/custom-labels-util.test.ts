import { mockFileUtil } from './mock-file-util';
import { indexCustomLabels } from '../custom-labels-util';
import { validate } from './util';

jest.mock('../file-flush-util', () => {
    return mockFileUtil();
});

it('indexCustomLabels', async done => {
    // workspace with one package
    const expectedDTS = `declare module "@label/c.greeting" {
    var greeting: string;
    export default greeting;
}
declare module "@label/c.other_greeting" {
    var other_greeting: string;
    export default other_greeting;
}
`;
    await validate(indexCustomLabels, 'sfdx-workspace', 'force-app', 'customlabels.d.ts', expectedDTS);

    // workspace with 2 packages
    const expectedDTS2 = `declare module "@label/c.greeting" {
    var greeting: string;
    export default greeting;
}
declare module "@label/c.other_greeting" {
    var other_greeting: string;
    export default other_greeting;
}
declare module "@label/c.utils" {
    var utils: string;
    export default utils;
}
`;
    await validate(indexCustomLabels, 'sfdx-workspace', '{force-app,utils}', 'customlabels.d.ts', expectedDTS2);
    done();
});
