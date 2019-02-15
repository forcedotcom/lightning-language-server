/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { IHTMLTagProvider } from '../parser/htmlTags';
//import { getAuraTagProvider } from '../../markup/auraTags';

// **** CHANGES TO HTML LANGUAGE SERVICE HERE **** //
let allTagProviders: IHTMLTagProvider[] = [
    // getAuraTagProvider(),
    // getHTML5TagProvider(),
    // getAngularTagProvider(),
    // getIonicTagProvider(),
    // getRazorTagProvider(),
];

export function addTagProvider(provider: IHTMLTagProvider) {
    allTagProviders.push(provider);
}

export function getTagProviders() {
    return allTagProviders;
}
