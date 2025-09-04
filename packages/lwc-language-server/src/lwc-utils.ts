/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */

import * as path from 'path';
import * as fs from 'fs-extra';

/**
 * LWC-specific utility functions
 */

/**
 * Checks if a file is an LWC component file
 */
export function isLWCComponentFile(filePath: string): boolean {
    const ext = path.extname(filePath);
    return ext === '.js' || ext === '.ts' || ext === '.html';
}

/**
 * Gets the component name from a file path
 */
export function getComponentNameFromPath(filePath: string): string {
    const dirName = path.basename(path.dirname(filePath));
    return dirName;
}

/**
 * Checks if a directory contains LWC components
 */
export async function isLWCComponentDirectory(dirPath: string): Promise<boolean> {
    try {
        const files = await fs.readdir(dirPath);
        const hasJS = files.some(file => file.endsWith('.js'));
        const hasHTML = files.some(file => file.endsWith('.html'));
        const hasTS = files.some(file => file.endsWith('.ts'));
        
        return (hasJS || hasTS) && hasHTML;
    } catch {
        return false;
    }
}
