/*
 * Copyright (c) 2025, salesforce.com, inc.
 * All rights reserved.
 * SPDX-License-Identifier: MIT
 * For full license text, see the LICENSE file in the repo root or https://opensource.org/licenses/MIT
 */

export interface ClassMember {
    name: string;
    type: DecoratorTargetType;
    value?: ClassMemberPropertyValue;
    decorator?: string;
    doc?: string;
    loc?: Location;
}

export interface ClassMemberPropertyValue {
    type: string;
    value: any;
}

export interface Location {
    start: Position;
    end: Position;
}

export interface Position {
    line: number;
    column: number;
}

export type DecoratorTargetType = DecoratorTargetProperty | DecoratorTargetMethod;
export type DecoratorTargetProperty = 'property';
export type DecoratorTargetMethod = 'method';
