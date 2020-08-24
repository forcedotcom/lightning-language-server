import * as path from 'path';
import decamelize from 'decamelize';

/**
 * @param file path to main .js/.html for component, i.e. card/card.js or card/card.html
 * @return tag name, i.e. c-card or namespace-card, or null if not the .js/.html file for a component
 */
export function tagFromFile(file: string, sfdxProject: boolean) {
    return nameFromFile(file, sfdxProject, tagName);
}
export function tagFromDirectory(file: string, sfdxProject: boolean) {
    return nameFromDirectory(file, sfdxProject, tagName);
}

/**
 * @param file path to main .js/.html for component, i.e. card/card.js or card/card.html
 * @return module name, i.e. c/card or namespace/card, or null if not the .js/.html file for a component
 */
export function moduleFromFile(file: string, sfdxProject: boolean) {
    return nameFromFile(file, sfdxProject, moduleName);
}
export function moduleFromDirectory(file: string, sfdxProject: boolean) {
    return nameFromDirectory(file, sfdxProject, moduleName);
}

export function componentFromFile(file: string, sfdxProject: boolean) {
    return nameFromFile(file, sfdxProject, componentName);
}
export function componentFromDirectory(file: string, sfdxProject: boolean) {
    return nameFromDirectory(file, sfdxProject, componentName);
}

function nameFromFile(file: string, sfdxProject: boolean, converter: (a: string, b: string) => string) {
    const filePath = path.parse(file);
    const fileName = filePath.name;
    const pathElements = splitPath(filePath);
    const parentDirName = pathElements.pop();
    if (fileName === parentDirName) {
        const namespace = sfdxProject ? 'c' : pathElements.pop();
        return converter(namespace, parentDirName);
    }
    return null;
}
function nameFromDirectory(file: string, sfdxProject: boolean, converter: (a: string, b: string) => string) {
    const filePath = path.parse(file);
    if (sfdxProject) {
        return converter('c', filePath.name);
    } else {
        // TODO verify
        return converter(splitPath(filePath).pop(), filePath.name);
    }
}

// TODO investigate more why this happens
function splitPath(filePath: path.ParsedPath): string[] {
    let pathElements = filePath.dir.split(path.sep);
    // Somehow on windows paths are occassionally using forward slash
    if (path.sep === '\\' && filePath.dir.indexOf('\\') === -1) {
        pathElements = filePath.dir.split('/');
    }
    return pathElements;
}

/**
 * @return true if file is the main .js file for a component
 */
export function isJSComponent(file: string): boolean {
    if (!file.toLowerCase().endsWith('.js')) {
        return false;
    }
    return tagFromFile(file, true) != null;
}

function tagName(namespace: string, tag: string) {
    if (namespace === 'interop') {
        // treat interop as lightning, i.e. needed when using extension with lightning-global
        // TODO: worth to add WorkspaceType.LIGHTNING_GLOBAL?
        namespace = 'lightning';
    }

    // convert camel-case to hyphen-case/kebab-case
    return namespace + '-' + decamelize(tag, '-');
}

function moduleName(namespace: string, tag: string) {
    if (namespace === 'interop') {
        // treat interop as lightning, i.e. needed when using extension with lightning-global
        // TODO: worth to add WorkspaceType.LIGHTNING_GLOBAL?
        namespace = 'lightning';
    }

    // convert camel-case to hyphen-case/kebab-case
    return namespace + '/' + tag;
    // TODO confirm we shouldn't be doing this anymore
    // + decamelize(tag, '-');
}

function componentName(namespace: string, tag: string) {
    return namespace + ':' + tag;
}
