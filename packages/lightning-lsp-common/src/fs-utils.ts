/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */

import * as fs from 'fs';

/**
 * Check if a file or directory exists asynchronously
 */
export const pathExists = (filePath: string): boolean => {
    try {
        fs.accessSync(filePath);
        return true;
    } catch {
        return false;
    }
};
