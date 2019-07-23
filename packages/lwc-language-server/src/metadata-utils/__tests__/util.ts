import { mockFileUtilHooks } from './mock-file-util';
import { join } from 'path';
import { WorkspaceContext } from 'lightning-lsp-common';
import { ISfdxProjectConfig } from 'lightning-lsp-common/lib/context';

export async function validate(
    indexer: (context: WorkspaceContext, writeConfigs: boolean) => Promise<void>,
    testWorkspace: string,
    sfdxPackageDirsPattern: string,
    expectedTypeDeclarationFileName: string,
    expectedTypeDeclarations: string,
) {
    mockFileUtilHooks.writeContents = (path, contents) => {
        expect(contents).toBe(expectedTypeDeclarations);
        expect(path).toContain(expectedTypeDeclarationFileName);
        return Promise.resolve();
    };

    const context = new class TestContext extends WorkspaceContext {
        public getSfdxProjectConfig(): Promise<ISfdxProjectConfig[]> {
            return Promise.resolve([
                {
                    packageDirectories: [],
                    sfdxPackageDirsPattern,
                },
            ]);
        }
    }(join(process.cwd(), 'test-workspaces', testWorkspace));
    await context.configureProject();
    await indexer(context, true);
}
// const context = new class TestContext extends WorkspaceContext {
//     public getSfdxProjectConfig(): Promise<ISfdxProjectConfig[]> {
//         return Promise.resolve({
//             sfdxProjectConfig : ISfdxProjectConfig[]
//         });
//     }
// }(join(process.cwd(), 'test-workspaces', testWorkspace));
// await context.configureProject();
