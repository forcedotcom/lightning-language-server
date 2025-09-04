import * as utils from './utils';
import { BaseWorkspaceContext, Indexer, AURA_EXTENSIONS } from './base-context';
import { WorkspaceContext } from './context';
import * as shared from './shared';
import { WorkspaceType } from './shared';
import { TagInfo } from './indexer/tagInfo';
import { AttributeInfo, Decorator, MemberType } from './indexer/attributeInfo';
import { interceptConsoleLogger } from './logger';

import {
    Metadata,
    ApiDecorator,
    TrackDecorator,
    WireDecorator,
    ClassMember,
    ModuleExports,
    Location,
    Position,
    DecoratorTargetType,
    DecoratorTargetProperty,
    DecoratorTargetMethod,
    ApiDecoratorTarget,
    TrackDecoratorTarget,
    WireDecoratorTarget,
    ClassMemberPropertyValue,
} from './decorators';

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
    Metadata,
    ApiDecorator,
    TrackDecorator,
    WireDecorator,
    ClassMember,
    ModuleExports,
    Location,
    Position,
    DecoratorTargetType,
    DecoratorTargetProperty,
    DecoratorTargetMethod,
    ApiDecoratorTarget,
    TrackDecoratorTarget,
    WireDecoratorTarget,
    ClassMemberPropertyValue,
    AURA_EXTENSIONS,
};
