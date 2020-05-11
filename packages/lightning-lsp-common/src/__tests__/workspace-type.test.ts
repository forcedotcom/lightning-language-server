import mockFs from 'mock-fs';
import { detectWorkspaceType, WorkspaceType } from '../shared';

describe('detectWorkspaceType', () => {
    beforeAll(() => {
        // Must be mocked when using mockFs
        // Calls to these APIs will result in exceptions during the test.
        // Issue: https://github.com/tschaub/mock-fs/issues/234
        console.log = jest.fn();
        console.error = jest.fn();
    });

    afterAll(() => {
        jest.resetAllMocks();
    });

    afterEach(() => {
        mockFs.restore();
    });

    test('when an sfdx-project.json file is present, workspaceType is SFDX', () => {
        mockFs({
            workspacedir: {
                'sfdx-project.json': '{}',
            },
        });

        const workspaceType = detectWorkspaceType(['workspacedir']);

        expect(workspaceType).toEqual(WorkspaceType.SFDX);
    });

    test('when an lwc.config.js file is present, workspaceType is STANDARD_LWC', () => {
        mockFs({
            workspacedir: {
                'lwc.config.js': '',
            },
        });

        const workspaceType = detectWorkspaceType(['workspacedir']);

        expect(workspaceType).toEqual(WorkspaceType.STANDARD_LWC);
    });

    test('when workspace-user.xml file is present at the root, workspaceType is CORE_ALL', () => {
        mockFs({
            workspacedir: {
                'workspace-user.xml': '<workspace></workspace>',
            },
        });

        const workspaceType = detectWorkspaceType(['workspacedir']);

        expect(workspaceType).toEqual(WorkspaceType.CORE_ALL);
    });

    test('when workspace-user.xml file is present at the parent of the root, workspaceType is CORE_PARTIAL', () => {
        mockFs({
            workspacedir: {},
            'workspace-user.xml': '<workspace></workspace>',
        });

        const workspaceType = detectWorkspaceType(['workspacedir']);

        expect(workspaceType).toEqual(WorkspaceType.CORE_PARTIAL);
    });

    test('when package.json dependencies includes @lwc/engine, workspaceType is STANDARD_LWC', () => {
        mockFs({
            workspacedir: {
                'package.json': JSON.stringify({
                    dependencies: {
                        '@lwc/engine': 1,
                    },
                }),
            },
        });

        const workspaceType = detectWorkspaceType(['workspacedir']);

        expect(workspaceType).toEqual(WorkspaceType.STANDARD_LWC);
    });

    test('when package.json dependencies includes @lwc/<anything>, workspaceType is STANDARD_LWC', () => {
        mockFs({
            workspacedir: {
                'package.json': JSON.stringify({
                    dependencies: {
                        '@lwc/compiler': 1,
                    },
                }),
            },
        });

        const workspaceType = detectWorkspaceType(['workspacedir']);

        expect(workspaceType).toEqual(WorkspaceType.STANDARD_LWC);
    });

    test('when package.json devDependencies includes @lwc/<anything>, workspaceType is STANDARD_LWC', () => {
        mockFs({
            workspacedir: {
                'package.json': JSON.stringify({
                    devDependencies: {
                        '@lwc/compiler': 1,
                    },
                }),
            },
        });

        const workspaceType = detectWorkspaceType(['workspacedir']);

        expect(workspaceType).toEqual(WorkspaceType.STANDARD_LWC);
    });
    test('when package.json dependencies includes @lwc/engine, workspaceType is STANDARD_LWC', () => {
        mockFs({
            workspacedir: {
                'package.json': JSON.stringify({
                    dependencies: {
                        '@lwc/engine': 1,
                    },
                }),
            },
        });

        const workspaceType = detectWorkspaceType(['workspacedir']);

        expect(workspaceType).toEqual(WorkspaceType.STANDARD_LWC);
    });

    test('when package.json devDependencies include @lwc/engine, workspaceType is STANDARD_LWC', () => {
        mockFs({
            workspacedir: {
                'package.json': JSON.stringify({
                    devDependencies: {
                        '@lwc/engine': 1,
                    },
                }),
            },
        });

        const workspaceType = detectWorkspaceType(['workspacedir']);
        expect(workspaceType).toEqual(WorkspaceType.STANDARD_LWC);
    });

    test('when package.json has the `lwc-services` dependency', () => {
        mockFs({
            workspacedir: {
                'package.json': JSON.stringify({
                    dependencies: {
                        'lwc-services': 1,
                    },
                }),
            },
        });

        const workspaceType = detectWorkspaceType(['workspacedir']);
        expect(workspaceType).toEqual(WorkspaceType.STANDARD_LWC);
    });

    test('when package.json has `lwc` configuration', () => {
        mockFs({
            workspacedir: {
                'package.json': JSON.stringify({
                    lwc: {
                        mapNamespaceFromPath: true,
                        modules: ['src/main/modules'],
                    },
                }),
            },
        });

        const workspaceType = detectWorkspaceType(['workspacedir']);
        expect(workspaceType).toEqual(WorkspaceType.STANDARD_LWC);
    });

    test('when package.json dependencies include lwc-services, workspaceType is STANDARD_LWC', () => {
        mockFs({
            workspacedir: {
                'package.json': JSON.stringify({
                    dependencies: {
                        'lwc-services': 1,
                    },
                }),
            },
        });

        const workspaceType = detectWorkspaceType(['workspacedir']);

        expect(workspaceType).toEqual(WorkspaceType.STANDARD_LWC);
    });

    test('when package.json devDependencies include lwc-services, workspaceType is STANDARD_LWC', () => {
        mockFs({
            workspacedir: {
                'package.json': JSON.stringify({
                    devDependencies: {
                        'lwc-services': 1,
                    },
                }),
            },
        });

        const workspaceType = detectWorkspaceType(['workspacedir']);

        expect(workspaceType).toEqual(WorkspaceType.STANDARD_LWC);
    });

    test('when package.json specifies workspaces, workspaceType is MONOREPO', () => {
        mockFs({
            workspacedir: {
                'package.json': JSON.stringify({
                    workspaces: [],
                }),
            },
        });

        const workspaceType = detectWorkspaceType(['workspacedir']);

        expect(workspaceType).toEqual(WorkspaceType.MONOREPO);
    });

    test('when lerna.json exists in project, workspaceType is MONOREPO', () => {
        mockFs({
            workspacedir: {
                'package.json': '{}',
                'lerna.json': '{}',
            },
        });

        const workspaceType = detectWorkspaceType(['workspacedir']);

        expect(workspaceType).toEqual(WorkspaceType.MONOREPO);
    });

    test('when package.json exists but no other conditions met, workspaceType is STANDARD', () => {
        mockFs({
            workspacedir: {
                'package.json': '{}',
            },
        });

        const workspaceType = detectWorkspaceType(['workspacedir']);

        expect(workspaceType).toEqual(WorkspaceType.STANDARD);
    });

    test('when no package.json, workspace-user.xml or sfdx-project.json, workspaceType is UNKNOWN', () => {
        mockFs({
            workspacedir: {
                'file.txt': '',
            },
        });

        const workspaceType = detectWorkspaceType(['workspacedir']);

        expect(workspaceType).toEqual(WorkspaceType.UNKNOWN);
    });
});

describe('detectWorkspaceType with mutliroot', () => {
    afterEach(() => {
        mockFs.restore();
    });

    test('when all projects are CORE_PARTIAL, workspaceType is CORE_PARTIAL', () => {
        mockFs({
            workspacedir: {
                'pom.xml': '',
            },
            workspacedir2: {
                'pom.xml': '',
            },
            'workspace-user.xml': '<workspace></workspace>',
        });

        const workspaceType = detectWorkspaceType(['workspacedir', 'workspacedir2']);

        expect(workspaceType).toEqual(WorkspaceType.CORE_PARTIAL);
    });

    // TODO: This will be invalid once we fix the logic to resolve against multiple project types.
    test('when none of the projects are CORE_PARTIAL, workspaceType is UNKNOWN', () => {
        mockFs({
            sfdx_workspace: {
                'sfdx-project.json': '{}',
            },
            core_all_workspace: {
                'project.json': '{}',
            },
            standard_lwc_workspace: {
                'package.json': JSON.stringify({
                    dependencies: {
                        '@lwc/engine': 1,
                    },
                }),
            },
        });

        const workspaceType = detectWorkspaceType(['sfdx_workspace', 'core_all_workspace', 'standard_lwc_workspace']);

        expect(workspaceType).toEqual(WorkspaceType.UNKNOWN);
    });

    // TODO: This will be invalid once we fix the logic to resolve against multiple project types.
    test('when not all of the projects are CORE_PARTIAL, workspaceType is UNKNOWN', () => {
        mockFs({
            sfdx_workspace: {
                'sfdx-project.json': '{}',
            },
            core_all_workspace: {
                'project.json': '{}',
            },
            standard_lwc_workspace: {
                'package.json': JSON.stringify({
                    dependencies: {
                        '@lwc/engine': 1,
                    },
                }),
            },
            core_partial_workspace: {
                'pom.xml': '',
            },
            'workspace-user.xml': '<workspace></workspace>',
        });

        const workspaceType = detectWorkspaceType(['sfdx_workspace', 'core_all_workspace', 'standard_lwc_workspace', 'core_partial_workspace']);

        expect(workspaceType).toEqual(WorkspaceType.UNKNOWN);
    });
});
