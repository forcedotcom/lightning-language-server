import * as utils from './utils';
import { BaseWorkspaceContext, Indexer, AURA_EXTENSIONS, processTemplate, getModulesDirs, updateForceIgnoreFile } from './base-context';
import * as shared from './shared';
import { WorkspaceType, WorkspaceTypes } from './shared';
import { TagInfo } from './indexer/tagInfo';
import { AttributeInfo, Decorators, MemberTypes, MemberType, DecoratorType } from './indexer/attributeInfo';
import { interceptConsoleLogger } from './logger';
import { findNamespaceRoots } from './namespace-utils';

import { ClassMember, Location, Position, ClassMemberPropertyValue, DecoratorTargetType, DecoratorTargetProperty, DecoratorTargetMethod } from './decorators';

export {
    BaseWorkspaceContext,
    Indexer,
    AURA_EXTENSIONS,
    utils,
    shared,
    WorkspaceType,
    WorkspaceTypes,
    TagInfo,
    AttributeInfo,
    Decorators,
    MemberTypes,
    MemberType,
    DecoratorType,
    interceptConsoleLogger,
    findNamespaceRoots,
    processTemplate,
    getModulesDirs,
    updateForceIgnoreFile,
    ClassMember,
    Location,
    Position,
    ClassMemberPropertyValue,
    DecoratorTargetType,
    DecoratorTargetProperty,
    DecoratorTargetMethod,
};
