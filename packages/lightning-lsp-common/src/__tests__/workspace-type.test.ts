describe('detectWorkspaceType', () => {
    test('when an sfdx-project.json file is present, workspaceType is SFDX', async () => {});

    test('when workspace-user.xml file is present at the root, workspaceType is CORE_ALL', async () => {});

    test('when workspace-user.xml file is present at the parent of the root, workspaceType is CORE_PARTIAL', async () => {});

    test('when package.json dependencies includes @lwc/engine, workspaceType is STANDARD_LWC', async () => {});

    test('when package.json devDependencies include @lwc/engine, workspaceType is STANDARD_LWC', async () => {});

    test('when package.json specifies workspaces, workspaceType is MONOREPO', async () => {});

    test('when lerna.json exists in project, workspaceType is MONOREPO', async () => {});

    test('when package.json exists but no other conditions met, workspaceType is STANDARD', async () => {});

    test('when no package.json, workspace-user.xml or sfdx-project.json, workspaceType is UNKNOWN', async () => {});
});

describe('detectWorkspaceType with mutliroot', () => {
    test('when all projects are CORE_PARTIAL, workspaceType is CORE_PARTIAL', async () => {});

    // TODO: This will be invalid once we fix the logic to resolve against multiple project types.
    test('when not all projects are CORE_PARTIAL, workspaceType is UNKNOWN', async () => {});
});
