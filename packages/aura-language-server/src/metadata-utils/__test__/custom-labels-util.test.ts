import { mockFileUtil } from './mock-file-util';
import { indexCustomLabels } from '../custom-labels-util';
import { validate } from './util';

jest.mock('../../utils', () => {
    return mockFileUtil();
});

it('indexCustomLabels', async done => {
    // workspace with one package
    const expectedDTS = `declare module "@salesforce/label/c.greeting" {
    var greeting: string;
    export default greeting;
}
declare module "@salesforce/label/c.other_greeting" {
    var other_greeting: string;
    export default other_greeting;
}
`;
    await validate(indexCustomLabels, 'sfdx-workspace', 'force-app', 'customlabels.d.ts', expectedDTS);

    // workspace with 2 packages
    const expectedDTS2 = `declare module "@salesforce/label/c.greeting" {
    var greeting: string;
    export default greeting;
}
declare module "@salesforce/label/c.other_greeting" {
    var other_greeting: string;
    export default other_greeting;
}
declare module "@salesforce/label/c.utils" {
    var utils: string;
    export default utils;
}
`;
    await validate(indexCustomLabels, 'sfdx-workspace', '{force-app,utils}', 'customlabels.d.ts', expectedDTS2);
    done();
});
