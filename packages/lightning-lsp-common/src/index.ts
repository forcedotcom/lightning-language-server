import * as utils from './utils';
import { WorkspaceContext, Indexer } from './context';
import * as shared from './shared';
import { TagInfo } from './indexer/tagInfo';
import { AttributeInfo, Decorator, MemberType } from './indexer/attributeInfo';
import { interceptConsoleLogger } from './logger';
import * as componentUtil from './component-util';
import {
    getLanguageService,
    LanguageService,
    ICompletionParticipant,
    HtmlContentContext,
    HtmlAttributeValueContext,
} from './html-language-service/htmlLanguageService';
import { IHTMLTagProvider } from './html-language-service/parser/htmlTags';
import { parse, Node } from './html-language-service/parser/htmlParser';

export {
    WorkspaceContext,
    Indexer,
    utils,
    componentUtil,
    shared,
    TagInfo,
    AttributeInfo,
    Decorator,
    MemberType,
    interceptConsoleLogger,
    getLanguageService,
    LanguageService,
    IHTMLTagProvider,
    parse,
    Node,
    ICompletionParticipant,
    HtmlContentContext,
    HtmlAttributeValueContext,
};
