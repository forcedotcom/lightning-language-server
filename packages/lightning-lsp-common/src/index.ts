import * as utils from './utils';
import { BaseWorkspaceContext, Indexer, AURA_EXTENSIONS } from './base-context';
import { WorkspaceContext } from './context';
import * as shared from './shared';
import { WorkspaceType } from './shared';
import { TagInfo } from './indexer/tagInfo';
import { AttributeInfo, Decorator, MemberType } from './indexer/attributeInfo';
import { interceptConsoleLogger } from './logger';

import { ClassMember, Location, Position, ClassMemberPropertyValue, DecoratorTargetType, DecoratorTargetProperty, DecoratorTargetMethod } from './decorators';

export {
    BaseWorkspaceContext,
    WorkspaceContext,
    Indexer,
    utils,
    shared,
    WorkspaceType,
    TagInfo,
    AttributeInfo,
    Decorator,
    MemberType,
    interceptConsoleLogger,
    ClassMember,
    Location,
    Position,
    ClassMemberPropertyValue,
    DecoratorTargetType,
    DecoratorTargetProperty,
    DecoratorTargetMethod,
    AURA_EXTENSIONS,
};
