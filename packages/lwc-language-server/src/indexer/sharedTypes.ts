/*
 * Copyright (c) 2018, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */

export interface Indexer {
    configureAndIndex(): Promise<void>;
    resetIndex(): void;
}

export interface TagInfo {
    name: string;
    location: Location;
}

export interface Location {
    uri: string;
    range: Range;
}

export interface Range {
    start: Position;
    end: Position;
}

export interface Position {
    line: number;
    character: number;
}
