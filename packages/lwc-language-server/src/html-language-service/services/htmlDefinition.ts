'use strict';

import { HTMLDocument } from '../parser/htmlParser';
import { TokenType } from '../parser/htmlScanner';
import { TextDocument, Position, Location } from 'vscode-languageserver-types';
import { allTagProviders } from './tagProviders';
import { getTokenInfo } from './htmlHover';

export function findDefinition(document: TextDocument, position: Position, htmlDocument: HTMLDocument): Location | null {
    const offset = document.offsetAt(position);
    const node = htmlDocument.findNodeAt(offset);
    if (!node || !node.tag) {
        return null;
    }

    const tagProviders = allTagProviders.filter(p => p.isApplicable(document.languageId));

    function getTagLocation(tag: string): Location | null {
        tag = tag.toLowerCase();
        for (const provider of tagProviders) {
            const info = provider.getTagInfo(tag);
            if (info && info.location) {
                return info.location;
            }
        }
        return null;
    }

    function getAttributeLocation(tag: string, attribute: string): Location | null {
        tag = tag.toLowerCase();
        for (const provider of tagProviders) {
            const tagInfo = provider.getTagInfo(tag);
            if (tagInfo) {
                const attrInfo = tagInfo.getAttributeInfo(attribute);
                if (attrInfo && attrInfo.location) {
                    return attrInfo.location;
                }
            }
        }
        return null;
    }

    if (node.endTagStart && offset >= node.endTagStart) {
        const endTagInfo = getTokenInfo(document, offset, TokenType.EndTag, node.endTagStart);
        if (endTagInfo) {
            return getTagLocation(node.tag);
        }
        return null;
    }

    const startTagInfo = getTokenInfo(document, offset, TokenType.StartTag, node.start);
    if (startTagInfo) {
        return getTagLocation(node.tag);
    }

    const attributeInfo = getTokenInfo(document, offset, TokenType.AttributeName, node.start);
    if (attributeInfo && attributeInfo.name) {
        return getAttributeLocation(node.tag, attributeInfo.name);
    }

    return null;
}
