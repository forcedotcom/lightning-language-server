import { join } from 'path';
import { WorkspaceContext } from '@salesforce/lightning-lsp-common';
import { ISfdxProjectConfig } from 'lightning-lsp-common/lib/context';
import * as fs from 'fs-extra';

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
    expect(contents).toBe(expectedTypeDeclarations); 
}
