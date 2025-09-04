/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */

import * as fs from 'fs-extra';
import * as path from 'path';
import { BaseWorkspaceContext, WorkspaceType } from '@salesforce/lightning-lsp-common';

/**
 * Holds information and utility methods for an Aura workspace
 */
export class AuraWorkspaceContext extends BaseWorkspaceContext {
    /**
     * @param workspaceRoots
     * @return AuraWorkspaceContext representing the workspace with workspaceRoots
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

                    if (await fs.pathExists(path.join(forceAppPath, 'lwc'))) {
                        roots.lwc.push(path.join(forceAppPath, 'lwc'));
                    }
                    if (await fs.pathExists(path.join(utilsPath, 'lwc'))) {
                        roots.lwc.push(path.join(utilsPath, 'lwc'));
                    }
                    if (await fs.pathExists(path.join(registeredEmptyPath, 'lwc'))) {
                        roots.lwc.push(path.join(registeredEmptyPath, 'lwc'));
                    }
                    if (await fs.pathExists(path.join(forceAppPath, 'aura'))) {
                        roots.aura.push(path.join(forceAppPath, 'aura'));
                    }
                }
                return roots;
            case WorkspaceType.CORE_ALL:
                // optimization: search only inside project/modules/
                for (const project of await fs.readdir(this.workspaceRoots[0])) {
                    const modulesDir = path.join(this.workspaceRoots[0], project, 'modules');
                    if (await fs.pathExists(modulesDir)) {
                        const subroots = await this.findNamespaceRoots(modulesDir, 2);
                        roots.lwc.push(...subroots.lwc);
                    }
                    const auraDir = path.join(this.workspaceRoots[0], project, 'components');
                    if (await fs.pathExists(auraDir)) {
                        const subroots = await this.findNamespaceRoots(auraDir, 2);
                        roots.aura.push(...subroots.lwc);
                    }
                }
                return roots;
            case WorkspaceType.CORE_PARTIAL:
                // optimization: search only inside modules/
                for (const ws of this.workspaceRoots) {
                    const modulesDir = path.join(ws, 'modules');
                    if (await fs.pathExists(modulesDir)) {
                        const subroots = await this.findNamespaceRoots(path.join(ws, 'modules'), 2);
                        roots.lwc.push(...subroots.lwc);
                    }
                    const auraDir = path.join(ws, 'components');
                    if (await fs.pathExists(auraDir)) {
                        const subroots = await this.findNamespaceRoots(path.join(ws, 'components'), 2);
                        roots.aura.push(...subroots.lwc);
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
                const unknownroots = await this.findNamespaceRoots(this.workspaceRoots[0], depth);
                roots.lwc.push(...unknownroots.lwc);
                roots.aura.push(...unknownroots.aura);
                return roots;
            }
        }
        return roots;
    }

    /**
     * Helper method to find namespace roots within a directory
     */
    private async findNamespaceRoots(root: string, maxDepth = 5): Promise<{ lwc: string[]; aura: string[] }> {
        const roots: { lwc: string[]; aura: string[] } = {
            lwc: [],
            aura: [],
        };

        function isModuleRoot(subdirs: string[]): boolean {
            for (const subdir of subdirs) {
                // Is a root if any subdir matches a name/name.js with name.js being a module
                const basename = path.basename(subdir);
                const modulePath = path.join(subdir, basename + '.js');
                if (fs.existsSync(modulePath)) {
                    // TODO: check contents for: from 'lwc'?
                    return true;
                }
            }
            return false;
        }

        async function traverse(candidate: string, depth: number): Promise<void> {
            if (--depth < 0) {
                return;
            }

            // skip traversing node_modules and similar
            const filename = path.basename(candidate);
            if (
                filename === 'node_modules' ||
                filename === 'bin' ||
                filename === 'target' ||
                filename === 'jest-modules' ||
                filename === 'repository' ||
                filename === 'git'
            ) {
                return;
            }

            // module_root/name/name.js
            const subdirs = await fs.readdir(candidate);
            const dirs = [];
            for (const file of subdirs) {
                const subdir = path.join(candidate, file);
                if ((await fs.stat(subdir)).isDirectory()) {
                    dirs.push(subdir);
                }
            }

            // Is a root if we have a folder called lwc
            const isDirLWC = isModuleRoot(dirs) || (!path.parse(candidate).ext && path.parse(candidate).name === 'lwc');
            if (isDirLWC) {
                roots.lwc.push(path.resolve(candidate));
            } else {
                for (const subdir of dirs) {
                    await traverse(subdir, depth);
                }
            }
        }

        if (fs.existsSync(root)) {
            await traverse(root, maxDepth);
        }
        return roots;
    }
}
