/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
/*!
BEGIN THIRD PARTY
*/
/*--------------------------------------------------------------------------------------------
 *  This file is based on or incorporates material from the projects listed below (Third Party IP).
 *  The original copyright notice and the license under which Microsoft received such Third Party IP,
 *  are set forth below. Such licenses and notices are provided for informational purposes only.
 *  Microsoft licenses the Third Party IP to you under the licensing terms for the Microsoft product.
 *  Microsoft reserves all other rights not expressly granted under this agreement, whether by implication,
 *  estoppel or otherwise.
 *--------------------------------------------------------------------------------------------*/
/*---------------------------------------------------------------------------------------------
 *  Copyright © 2015 W3C® (MIT, ERCIM, Keio, Beihang). This software or document includes includes material copied
 *  from or derived from HTML 5.1 W3C Working Draft (http://www.w3.org/TR/2015/WD-html51-20151008/.)"
 *--------------------------------------------------------------------------------------------*/
/*---------------------------------------------------------------------------------------------
 *  Ionic Main Site (https://github.com/driftyco/ionic-site).
 *  Copyright Drifty Co. http://drifty.com/.
 *
 *  Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file
 *  except in compliance with the License. You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *
 *  THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 *  KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED
 *  WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
 *  MERCHANTABLITY OR NON-INFRINGEMENT.
 *
 *  See the Apache Version 2.0 License for specific language governing permissions
 *  and limitations under the License.
 *--------------------------------------------------------------------------------------------*/

import * as strings from '../utils/strings';
import * as arrays from '../utils/arrays';
import * as nls from 'vscode-nls';
import { TagInfo } from '../../indexer/tagInfo';
import { AttributeInfo } from '../../indexer/attributeInfo';
let localize = nls.loadMessageBundle();

export const EMPTY_ELEMENTS: string[] = [
    'area',
    'base',
    'br',
    'col',
    'embed',
    'hr',
    'img',
    'input',
    'keygen',
    'link',
    'menuitem',
    'meta',
    'param',
    'source',
    'track',
    'wbr',
];

export function isEmptyElement(e: string): boolean {
    return !!e && arrays.binarySearch(EMPTY_ELEMENTS, e.toLowerCase(), (s1: string, s2: string) => s1.localeCompare(s2)) >= 0;
}

export interface IHTMLTagProvider {
    getId(): string;
    isApplicable(languageId: string): boolean;
    collectTags(collector: (tag: string, label: string, info: TagInfo) => void): void;
    collectAttributes(tag: string, collector: (attribute: string, info: AttributeInfo, type?: string) => void): void;
    collectValues(tag: string, attribute: string, collector: (value: string) => void): void;
    // TODO these are a bit hacky and not part of the original html tag provider interface
    // we should see if we can utilize existing htmlLS functions to accomplish the same thing
    getTagInfo(tag: string): TagInfo;
    getGlobalAttributes(): AttributeInfo[];
    collectExpressionValues(templateTag: string, collector: (value: string) => void): void;
}

export interface ITagSet {
    [tag: string]: HTMLTagSpecification;
}

export class HTMLTagSpecification {
    constructor(public label: string, public attributes: string[] = []) {}
}

interface IValueSets {
    [tag: string]: string[];
}

function collectTagsDefault(collector: (tag: string, label: string) => void, tagSet: ITagSet): void {
    for (var tag in tagSet) {
        collector(tag, tagSet[tag].label);
    }
}

function collectValuesDefault(
    tag: string,
    attribute: string,
    collector: (value: string) => void,
    tagSet: ITagSet,
    globalAttributes: string[],
    valueSets: IValueSets,
    customTags?: { [tag: string]: string[] },
): void {
    var prefix = attribute + ':';
    var processAttributes = (attributes: string[]) => {
        attributes.forEach(attr => {
            if (attr.length > prefix.length && strings.startsWith(attr, prefix)) {
                var typeInfo = attr.substr(prefix.length);
                if (typeInfo === 'v') {
                    collector(attribute);
                } else {
                    var values = valueSets[typeInfo];
                    if (values) {
                        values.forEach(collector);
                    }
                }
            }
        });
    };
    if (tag) {
        var tags = tagSet[tag];
        if (tags) {
            var attributes = tags.attributes;
            if (attributes) {
                processAttributes(attributes);
            }
        }
    }
    processAttributes(globalAttributes);
    if (customTags) {
        var customTagAttributes = customTags[tag];
        if (customTagAttributes) {
            processAttributes(customTagAttributes);
        }
    }
}
/*!
END THIRD PARTY
*/
