import { mockFileUtilHooks } from './mock-file-util';
import { join } from 'path';

export async function validate(
    indexer: (path: string, sfdxPackageDirsPattern: string) => Promise<void>,
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
    await indexer(join(process.cwd(), 'test-workspaces', testWorkspace), sfdxPackageDirsPattern);
}
