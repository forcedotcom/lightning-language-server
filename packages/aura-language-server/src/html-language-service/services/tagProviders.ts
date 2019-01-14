/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { getHTML5TagProvider, getAngularTagProvider, getIonicTagProvider, IHTMLTagProvider } from '../parser/htmlTags';
import { getAuraTagProvider } from '../../markup/auraTags';
import { getRazorTagProvider } from '../parser/razorTags';

// **** CHANGES TO HTML LANGUAGE SERVICE HERE ****
export let allTagProviders: IHTMLTagProvider[] = [
    getAuraTagProvider(),
    getHTML5TagProvider(),
    getAngularTagProvider(),
    getIonicTagProvider(),
    getRazorTagProvider(),
];
