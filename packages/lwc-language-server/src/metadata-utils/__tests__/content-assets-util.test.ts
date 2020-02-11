import { indexContentAssets } from '../content-assets-util';
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

it('indexContentAssets', async done => {
    const expectedDTS = `declare module "@salesforce/contentAssetUrl/logo" {
    var logo: string;
    export default logo;
}
`;

    await validate(indexContentAssets, 'sfdx-workspace', 'force-app', 'contentassets.d.ts', expectedDTS);
    done();
});
