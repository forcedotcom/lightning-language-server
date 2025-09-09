/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */

import * as fs from 'fs';
import * as path from 'path';
import {
    BaseWorkspaceContext,
    WorkspaceType,
    findNamespaceRoots,
    utils,
    pathExists,
    ensureDirSync,
    processTemplate,
    getModulesDirs,
} from '@salesforce/lightning-lsp-common';
import { TextDocument } from 'vscode-languageserver';

const updateConfigFile = (filePath: string, content: string): void => {
    console.log('updateConfigFile: Starting with filePath:', filePath);
    const dir = path.dirname(filePath);
    console.log('updateConfigFile: Directory:', dir);
    ensureDirSync(dir);
    console.log('updateConfigFile: Directory ensured, about to write file');
    fs.writeFileSync(filePath, content);
    console.log('updateConfigFile: File written successfully:', filePath);
};

const updateForceIgnoreFile = async (forceignorePath: string, addTsConfig: boolean): Promise<void> => {
    let forceignoreContent = '';
    if (await pathExists(forceignorePath)) {
        forceignoreContent = await fs.promises.readFile(forceignorePath, 'utf8');
    }

    // Add standard forceignore patterns for JavaScript projects
    if (!forceignoreContent.includes('**/jsconfig.json')) {
        forceignoreContent += '\n**/jsconfig.json';
    }
    if (!forceignoreContent.includes('**/.eslintrc.json')) {
        forceignoreContent += '\n**/.eslintrc.json';
    }

    if (addTsConfig && !forceignoreContent.includes('**/tsconfig.json')) {
        forceignoreContent += '\n**/tsconfig.json';
    }

    if (addTsConfig && !forceignoreContent.includes('**/*.ts')) {
        forceignoreContent += '\n**/*.ts';
    }

    // Always write the forceignore file, even if it's empty
    await fs.promises.writeFile(forceignorePath, forceignoreContent.trim());
};

/**
 * Holds information and utility methods for a LWC workspace
 */
export class LWCWorkspaceContext extends BaseWorkspaceContext {
    /**
     * @param workspaceRoots
     * @return LWCWorkspaceContext representing the workspace with workspaceRoots
     */
    public constructor(workspaceRoots: string[] | string) {
        super(workspaceRoots);
    }

    /**
     * @returns string list of all lwc and aura namespace roots
     */
    protected async findNamespaceRootsUsingType(): Promise<{ lwc: string[]; aura: string[] }> {
        const roots: { lwc: string[]; aura: string[] } = {
            lwc: [],
            aura: [],
        };
        switch (this.type) {
            case WorkspaceType.SFDX:
                // For SFDX workspaces, check for both lwc and aura directories
                for (const root of this.workspaceRoots) {
                    const forceAppPath = path.join(root, 'force-app', 'main', 'default');
                    const utilsPath = path.join(root, 'utils', 'meta');
                    const registeredEmptyPath = path.join(root, 'registered-empty-folder', 'meta');

                    if (await pathExists(path.join(forceAppPath, 'lwc'))) {
                        roots.lwc.push(path.join(forceAppPath, 'lwc'));
                    }
                    if (await pathExists(path.join(utilsPath, 'lwc'))) {
                        roots.lwc.push(path.join(utilsPath, 'lwc'));
                    }
                    if (await pathExists(path.join(registeredEmptyPath, 'lwc'))) {
                        roots.lwc.push(path.join(registeredEmptyPath, 'lwc'));
                    }
                    if (await pathExists(path.join(forceAppPath, 'aura'))) {
                        roots.aura.push(path.join(forceAppPath, 'aura'));
                    }
                }
                return roots;
            case WorkspaceType.CORE_ALL:
                // optimization: search only inside project/modules/
                for (const project of await fs.promises.readdir(this.workspaceRoots[0])) {
                    const modulesDir = path.join(this.workspaceRoots[0], project, 'modules');
                    if (await pathExists(modulesDir)) {
                        const subroots = await findNamespaceRoots(modulesDir, 2);
                        roots.lwc.push(...subroots.lwc);
                    }
                }
                return roots;
            case WorkspaceType.CORE_PARTIAL:
                // optimization: search only inside modules/
                for (const ws of this.workspaceRoots) {
                    const modulesDir = path.join(ws, 'modules');
                    if (await pathExists(modulesDir)) {
                        const subroots = await findNamespaceRoots(path.join(ws, 'modules'), 2);
                        roots.lwc.push(...subroots.lwc);
                    }
                }
                return roots;
            case WorkspaceType.STANDARD:
            case WorkspaceType.STANDARD_LWC:
            case WorkspaceType.MONOREPO:
            case WorkspaceType.UNKNOWN: {
                let depth = 6;
                if (this.type === WorkspaceType.MONOREPO) {
                    depth += 2;
                }
                const unknownroots = await findNamespaceRoots(this.workspaceRoots[0], depth);
                roots.lwc.push(...unknownroots.lwc);
                roots.aura.push(...unknownroots.aura);
                return roots;
            }
        }
        return roots;
    }

    /**
     * Updates the namespace root type cache
     */
    public async updateNamespaceRootTypeCache(): Promise<void> {
        this.findNamespaceRootsUsingTypeCache = utils.memoize(this.findNamespaceRootsUsingType.bind(this));
    }

    /**
     * Configures LWC project to support TypeScript
     */
    public async configureProjectForTs(): Promise<void> {
        try {
            // TODO: This should be moved into configureProject after dev preview
            await this.writeTsconfigJson();
        } catch (error) {
            console.error('configureProjectForTs: Error occurred:', error);
            throw error;
        }
    }

    /**
     * Writes TypeScript configuration files for the project
     */
    protected async writeTsconfigJson(): Promise<void> {
        switch (this.type) {
            case WorkspaceType.SFDX:
                // Write tsconfig.sfdx.json first
                const baseTsConfigPath = path.join(this.workspaceRoots[0], '.sfdx', 'tsconfig.sfdx.json');

                try {
                    const baseTsConfig = await fs.promises.readFile(utils.getSfdxResource('tsconfig-sfdx.base.json'), 'utf8');
                    updateConfigFile(baseTsConfigPath, baseTsConfig);
                } catch (error) {
                    console.error('writeTsconfigJson: Error reading/writing base tsconfig:', error);
                    throw error;
                }

                // Write to the tsconfig.json in each module subdirectory
                let tsConfigTemplate: string;
                try {
                    tsConfigTemplate = await fs.promises.readFile(utils.getSfdxResource('tsconfig-sfdx.json'), 'utf8');
                } catch (error) {
                    console.error('writeTsconfigJson: Error reading tsconfig template:', error);
                    throw error;
                }

                const forceignore = path.join(this.workspaceRoots[0], '.forceignore');
                // TODO: We should only be looking through modules that have TS files
                const modulesDirs = await getModulesDirs(this.type, this.workspaceRoots, this.initSfdxProjectConfigCache.bind(this));
                console.log('writeTsconfigJson: modulesDirs found:', modulesDirs);
                console.log('writeTsconfigJson: modulesDirs length:', modulesDirs.length);

                for (const modulesDir of modulesDirs) {
                    const tsConfigPath = path.join(modulesDir, 'tsconfig.json');
                    console.log('writeTsconfigJson: Processing modulesDir:', modulesDir);
                    console.log('writeTsconfigJson: tsConfigPath:', tsConfigPath);

                    const relativeWorkspaceRoot = utils.relativePath(path.dirname(tsConfigPath), this.workspaceRoots[0]);
                    console.log('writeTsconfigJson: relativeWorkspaceRoot:', relativeWorkspaceRoot);

                    const tsConfigContent = processTemplate(tsConfigTemplate, { project_root: relativeWorkspaceRoot });
                    console.log('writeTsconfigJson: About to call updateConfigFile for:', tsConfigPath);

                    updateConfigFile(tsConfigPath, tsConfigContent);
                    console.log('writeTsconfigJson: updateConfigFile completed for:', tsConfigPath);

                    await updateForceIgnoreFile(forceignore, true);
                    console.log('writeTsconfigJson: updateForceIgnoreFile completed');
                }
                break;
            default:
                break;
        }
    }

    public async isLWCJavascript(document: TextDocument): Promise<boolean> {
        return document.languageId === 'javascript' && (await this.isInsideModulesRoots(document));
    }
}
