import * as utils from './utils';
import { BaseWorkspaceContext, Indexer, AURA_EXTENSIONS, processTemplate, getModulesDirs, updateForceIgnoreFile } from './base-context';
import * as shared from './shared';
import { WorkspaceType } from './shared';
import { TagInfo } from './indexer/tagInfo';
import { AttributeInfo, Decorator, MemberType } from './indexer/attributeInfo';
import { interceptConsoleLogger } from './logger';
import { findNamespaceRoots } from './namespace-utils';
import { pathExists } from './fs-utils';

import { ClassMember, Location, Position, ClassMemberPropertyValue, DecoratorTargetType, DecoratorTargetProperty, DecoratorTargetMethod } from './decorators';

export {
    BaseWorkspaceContext,
    Indexer,
    AURA_EXTENSIONS,
    utils,
    shared,
    WorkspaceType,
    TagInfo,
    AttributeInfo,
    Decorator,
    MemberType,
    interceptConsoleLogger,
    findNamespaceRoots,
    pathExists,
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
