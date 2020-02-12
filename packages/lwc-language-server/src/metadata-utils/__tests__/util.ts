import { join } from 'path';
import { WorkspaceContext } from '@salesforce/lightning-lsp-common';
import { ISfdxProjectConfig } from '@salesforce/lightning-lsp-common/lib/context';
import * as fs from 'fs-extra';
import eol from 'eol';

export async function validate(
    indexer: (context: WorkspaceContext, writeConfigs: boolean) => Promise<void>,
    testWorkspace: string,
    sfdxPackageDirsPattern: string,
    expectedTypeDeclarationFileName: string,
    expectedTypeDeclarations: string,
) {
    const workspacePath = join(process.cwd(), 'test-workspaces', testWorkspace);
    const context = new (class TestContext extends WorkspaceContext {
        public getSfdxProjectConfig(): Promise<ISfdxProjectConfig> {
            return Promise.resolve({
                packageDirectories: [],
                sfdxPackageDirsPattern,
            });
        }
    })(workspacePath);
    await context.configureProject();

    await indexer(context, true);
    const path = join(workspacePath, '.sfdx', 'typings', 'lwc', expectedTypeDeclarationFileName);
    expect(path).toExist();
    const contents = fs.readFileSync(path, 'utf8');
    const expected = eol.auto(expectedTypeDeclarations);

    const output = [];
    for (let c = 0; c < contents.length; c++) {
        if (contents.charCodeAt(c) === expected.charCodeAt(c)) {
            output.push(contents[c]);
        } else {
            // fail(`Characters at position: ${c} did not equal. Expected: ${expected[c]} Actual: ${contents[c]}`);
            output.push(`[${contents.charCodeAt(c)}:${contents[c]}:${expected[c]}]`);
        }
    }
    console.log(output.join(''));

    expect(contents.length).toEqual(expected.length);
    expect(contents).toEqual(expected);
}
