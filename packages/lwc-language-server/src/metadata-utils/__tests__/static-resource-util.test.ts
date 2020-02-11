import { indexStaticResources } from '../static-resources-util';
import { validate } from './util';
import { FORCE_APP_ROOT } from '../../__tests__/test-utils';
import * as fs from 'fs-extra';

beforeEach(() => {
    const jsconfigPathForceApp = FORCE_APP_ROOT + '/lwc/jsconfig.json';
    const sfdxTypingsPath = 'test-workspaces/sfdx-workspace/.sfdx/typings/lwc';
    const forceignorePath = 'test-workspaces/sfdx-workspace/.forceignore';

    // make sure no generated files are there from previous runs
    fs.removeSync(jsconfigPathForceApp);
    fs.removeSync(forceignorePath);
    fs.removeSync(sfdxTypingsPath);
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
