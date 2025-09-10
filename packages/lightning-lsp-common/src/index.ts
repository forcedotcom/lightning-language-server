// Re-export all named exports from utils
export {
    toResolvedPath,
    isLWCWatchedDirectory,
    isAuraWatchedDirectory,
    includesDeletedLwcWatchedDirectory,
    includesDeletedAuraWatchedDirectory,
    containsDeletedLwcWatchedDirectory,
    isLWCRootDirectoryCreated,
    isAuraRootDirectoryCreated,
    unixify,
    relativePath,
    pathStartsWith,
    getExtension,
    getBasename,
    getSfdxResource,
    getCoreResource,
    appendLineIfMissing,
    deepMerge,
    elapsedMillis,
    memoize,
    readJsonSync,
    writeJsonSync,
} from './utils';

// Re-export utils as a namespace
export * as utils from './utils';

// Re-export from base-context
export { BaseWorkspaceContext, Indexer, AURA_EXTENSIONS, processTemplate, getModulesDirs, updateForceIgnoreFile } from './base-context';

// Re-export from shared
export * from './shared';
export * as shared from './shared';

// Re-export from indexer
export { TagInfo } from './indexer/tagInfo';
export { AttributeInfo, Decorator, MemberType } from './indexer/attributeInfo';

// Re-export from other modules
export { interceptConsoleLogger } from './logger';
export { findNamespaceRoots } from './namespace-utils';

// Re-export from decorators
export { ClassMember, Location, Position, ClassMemberPropertyValue, DecoratorTargetType, DecoratorTargetProperty, DecoratorTargetMethod } from './decorators';
