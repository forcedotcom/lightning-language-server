/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
'use strict';

import { IHTMLTagProvider } from '../parser/htmlTags';
import { getLwcTagProvider } from '../parser/lwcTags';

export let allTagProviders: IHTMLTagProvider[] = [
    getLwcTagProvider(),
];
