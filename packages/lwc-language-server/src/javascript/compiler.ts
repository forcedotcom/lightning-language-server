import { SourceLocation } from 'babel-types';
import * as path from 'path';
import * as fs from 'fs-extra';
import { Diagnostic, DiagnosticSeverity, Location, Position, Range, TextDocument } from 'vscode-languageserver';
import { URI } from 'vscode-uri';
import { DIAGNOSTIC_SOURCE, MAX_32BIT_INTEGER } from '../constants';
import { BundleConfig, ScriptFile, collectBundleMetadata } from '@lwc/metadata';
import { transformSync } from '@lwc/compiler';
import { mapLwcMetadataToInternal } from './type-mapping';
import { AttributeInfo, ClassMember, Decorator as DecoratorType, MemberType, Metadata } from '@salesforce/lightning-lsp-common';
import commentParser from 'comment-parser';

export interface CompilerResult {
    diagnostics?: Diagnostic[]; // NOTE: vscode Diagnostic, not lwc Diagnostic
    metadata?: Metadata;
}

function getClassMembers(metadata: Metadata, memberType: string, memberDecorator?: string): ClassMember[] {
    const members: ClassMember[] = [];
    if (metadata.classMembers) {
        for (const member of metadata.classMembers) {
            if (member.type === memberType) {
                if (!memberDecorator || member.decorator === memberDecorator) {
                    members.push(member);
                }
            }
        }
    }
    return members;
}

function getDecoratorsTargets(metadata: Metadata, elementType: string, targetType: string): ClassMember[] {
    const props: ClassMember[] = [];
    if (metadata.decorators) {
        for (const element of metadata.decorators) {
            if (element.type === elementType) {
                for (const target of element.targets) {
                    if (target.type === targetType) {
                        props.push(target);
                    }
                }
                break;
            }
        }
    }
    return props;
}

export function getPublicReactiveProperties(metadata: Metadata): ClassMember[] {
    return getClassMembers(metadata, 'property', 'api');
}

export function getPrivateReactiveProperties(metadata: Metadata): ClassMember[] {
    return getDecoratorsTargets(metadata, 'track', 'property');
}

export function getApiMethods(metadata: Metadata): ClassMember[] {
    return getDecoratorsTargets(metadata, 'api', 'method');
}

export function getProperties(metadata: Metadata): ClassMember[] {
    return getClassMembers(metadata, 'property');
}

export function getMethods(metadata: Metadata): ClassMember[] {
    return getClassMembers(metadata, 'method');
}

function sanitizeComment(comment: string): string {
    const parsed = commentParser('/*' + comment + '*/');
    return parsed && parsed.length > 0 ? parsed[0].source : null;
}

function patchComments(metadata: Metadata): void {
    if (metadata.doc) {
        metadata.doc = sanitizeComment(metadata.doc);
        for (const classMember of metadata.classMembers) {
            if (classMember.doc) {
                classMember.doc = sanitizeComment(classMember.doc);
            }
        }
    }
}

export function extractLocationFromBabelError(message: string): any {
    const m = message.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
    const startLine = m.indexOf('\n> ') + 3;
    const line = parseInt(m.substring(startLine, m.indexOf(' | ', startLine)), 10);
    const startColumn = m.indexOf('    | ', startLine);
    const mark = m.indexOf('^', startColumn);
    const column = mark - startColumn - 6;
    const location = { line, column };
    return location;
}

export function extractMessageFromBabelError(message: string): string {
    const start = message.indexOf(': ') + 2;
    const end = message.indexOf('\n', start);
    return message.substring(start, end);
}

// TODO: proper type for 'err' (i.e. SyntaxError)
function toDiagnostic(err: any): Diagnostic {
    // TODO: 'err' doesn't have end loc, squiggling until the end of the line until babel 7 is released
    const message = err.message;
    let location = err.location;
    if (!location) {
        location = extractLocationFromBabelError(message);
    }
    const startLine: number = location.line - 1;
    const startCharacter: number = location.column;
    // https://github.com/forcedotcom/salesforcedx-vscode/issues/2074
    // Limit the end character to max 32 bit integer so that it doesn't overflow other language servers
    const range = Range.create(startLine, startCharacter, startLine, MAX_32BIT_INTEGER);
    return {
        range,
        severity: DiagnosticSeverity.Error,
        source: DIAGNOSTIC_SOURCE,
        message: extractMessageFromBabelError(message),
    };
}

export async function compileSource(source: string, fileName = 'foo.js'): Promise<CompilerResult> {
    const name = fileName.substring(0, fileName.lastIndexOf('.'));

    const transformOptions = {
        name,
        namespace: 'x',
    };
    try {
        transformSync(source, fileName, transformOptions);
    } catch (err) {
        return {
            diagnostics: [toDiagnostic(err)],
        };
    }

    const options: BundleConfig = {
        type: 'platform',
        name,
        namespace: 'x',
        namespaceMapping: {},
        files: [
            {
                fileName,
                source,
            },
        ],
        npmModuleMapping: {},
    };
    const modernMetadata = collectBundleMetadata(options);
    if (modernMetadata.diagnostics.length) {
        return {
            diagnostics: modernMetadata.diagnostics.map(toDiagnostic),
        };
    }

    const metadata = mapLwcMetadataToInternal(modernMetadata.files[0] as ScriptFile);
    patchComments(metadata);

    return { metadata, diagnostics: [] };
}

/**
 * Use to compile a live document (contents may be different from current file in disk)
 */
export async function compileDocument(document: TextDocument): Promise<CompilerResult> {
    const file = URI.file(document.uri).fsPath;
    const filePath = path.parse(file);
    const fileName = filePath.base;
    return compileSource(document.getText(), fileName);
}

export async function compileFile(file: string): Promise<CompilerResult> {
    const filePath = path.parse(file);
    const fileName = filePath.base;
    const data = await fs.readFile(file, 'utf-8');
    return compileSource(data, fileName);
}

export function toVSCodeRange(babelRange: SourceLocation): Range {
    // babel (column:0-based line:1-based) => vscode (character:0-based line:0-based)
    return Range.create(Position.create(babelRange.start.line - 1, babelRange.start.column), Position.create(babelRange.end.line - 1, babelRange.end.column));
}

export function extractAttributes(metadata: Metadata, uri: string): { privateAttributes: AttributeInfo[]; publicAttributes: AttributeInfo[] } {
    const publicAttributes: AttributeInfo[] = [];
    const privateAttributes: AttributeInfo[] = [];
    for (const x of getProperties(metadata)) {
        if (x.decorator === 'api') {
            const location = Location.create(uri, toVSCodeRange(x.loc));

            const name = x.name.replace(/([A-Z])/g, (match: string) => `-${match.toLowerCase()}`);
            const memberType = x.type === 'property' ? MemberType.PROPERTY : MemberType.METHOD;
            publicAttributes.push(new AttributeInfo(name, x.doc, memberType, DecoratorType.API, undefined, location, 'LWC custom attribute'));
        } else {
            const location = Location.create(uri, toVSCodeRange(x.loc));

            const name = x.name.replace(/([A-Z])/g, (match: string) => `-${match.toLowerCase()}`);
            const memberType = x.type === 'property' ? MemberType.PROPERTY : MemberType.METHOD;
            const decorator = x.decorator === 'track' ? DecoratorType.TRACK : undefined;
            privateAttributes.push(new AttributeInfo(name, x.doc, memberType, decorator, undefined, location, 'LWC custom attribute'));
        }
    }
    return {
        publicAttributes,
        privateAttributes,
    };
}
