import * as utils from './utils';
import { BaseWorkspaceContext, Indexer, AURA_EXTENSIONS } from './base-context';
import * as shared from './shared';
import { WorkspaceType } from './shared';
import { TagInfo } from './indexer/tagInfo';
import { AttributeInfo, Decorator, MemberType } from './indexer/attributeInfo';
import { interceptConsoleLogger } from './logger';
import { findNamespaceRoots } from './namespace-utils';
import { pathExists, ensureDir, ensureDirSync, removeFile, removeDir } from './fs-utils';

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
    ensureDir,
    ensureDirSync,
    removeFile,
    removeDir,
    ClassMember,
    Location,
    Position,
    ClassMemberPropertyValue,
    DecoratorTargetType,
    DecoratorTargetProperty,
    DecoratorTargetMethod,
};
