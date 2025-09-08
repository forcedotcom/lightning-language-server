/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * Check if a directory contains module roots
 */
const isModuleRoot = (subdirs: string[]): boolean => {
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
};

/**
 * Recursively traverse directories to find namespace roots
 */
const traverse = async (candidate: string, depth: number, roots: { lwc: string[]; aura: string[] }): Promise<void> => {
    if (--depth < 0) {
        return;
    }

    // skip traversing node_modules and similar
    const filename = path.basename(candidate);
    if (['node_modules', 'bin', 'target', 'jest-modules', 'repository', 'git'].includes(filename)) {
        return;
    }

    // module_root/name/name.js
    const subdirs = fs.readdirSync(candidate);
    const dirs = [];
    for (const file of subdirs) {
        const subdir = path.join(candidate, file);
        if (fs.statSync(subdir).isDirectory()) {
            dirs.push(subdir);
        }
    }

    // Is a root if we have a folder called lwc
    const isDirLWC = isModuleRoot(dirs) || (!path.parse(candidate).ext && path.parse(candidate).name === 'lwc');
    if (isDirLWC) {
        roots.lwc.push(path.resolve(candidate));
    } else {
        for (const subdir of dirs) {
            await traverse(subdir, depth, roots);
        }
    }
};

/**
 * Helper function to find namespace roots within a directory
 */
export const findNamespaceRoots = async (root: string, maxDepth = 5): Promise<{ lwc: string[]; aura: string[] }> => {
    const roots: { lwc: string[]; aura: string[] } = {
        lwc: [],
        aura: [],
    };

    if (fs.existsSync(root)) {
        await traverse(root, maxDepth, roots);
    }
    return roots;
};
