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
export const pathExists = async (filePath: string): Promise<boolean> => {
    try {
        await fs.promises.access(filePath);
        return true;
    } catch {
        return false;
    }
};

/**
 * Ensure a directory exists, creating it if necessary (async)
 */
export const ensureDir = async (dirPath: string): Promise<void> => {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
};

/**
 * Ensure a directory exists, creating it if necessary (sync)
 */
export const ensureDirSync = (dirPath: string): void => {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
};

/**
 * Remove a file if it exists (safe file removal)
 */
export const removeFile = (filePath: string): void => {
    if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
    }
};

/**
 * Remove a directory if it exists (safe directory removal)
 */
export const removeDir = (dirPath: string): void => {
    if (fs.existsSync(dirPath)) {
        fs.rmSync(dirPath, { recursive: true, force: true });
    }
};
