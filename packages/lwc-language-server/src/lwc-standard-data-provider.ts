import { newHTMLDataProvider } from 'vscode-html-languageservice';
import * as fs from 'fs-extra';
import { join } from 'path';

const standardData = fs.readFileSync(join(__dirname, 'resources/standard-lwc.json'), 'utf-8');
const standardJson = JSON.parse(standardData);

const LWCStandardDataProvider = newHTMLDataProvider('standard-lwc', {
    version: standardJson.version,
    tags: standardJson.tags,
    globalAttributes: standardJson.globalAttributes,
});

export default LWCStandardDataProvider;
