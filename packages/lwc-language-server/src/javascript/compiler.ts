import { SourceLocation, Decorator } from 'babel-types';
import * as path from 'path';
import * as fs from 'fs-extra';
import { Diagnostic, DiagnosticSeverity, Location, Position, Range, TextDocument } from 'vscode-languageserver';
import URI from 'vscode-uri';
import { DIAGNOSTIC_SOURCE, MAX_32BIT_INTEGER } from '../constants';
import { transform } from '@lwc/compiler';
import { CompilerOptions } from '@lwc/compiler/dist/types/compiler/options';
import { ClassMember } from '@lwc/babel-plugin-component';
import { AttributeInfo, Decorator as DecoratorType, MemberType } from '@salesforce/lightning-lsp-common';
import { Metadata } from '@lwc/babel-plugin-component';
import commentParser from 'comment-parser';

export interface ICompilerResult {
    diagnostics?: Diagnostic[]; // NOTE: vscode Diagnostic, not lwc Diagnostic
    metadata?: Metadata;
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

/**
 * Use to compile a live document (contents may be different from current file in disk)
 */
export async function compileDocument(document: TextDocument): Promise<ICompilerResult> {
    const file = URI.file(document.uri).fsPath;
    const filePath = path.parse(file);
    const fileName = filePath.base;
    return compileSource(document.getText(), fileName);
}

export async function compileFile(file: string): Promise<ICompilerResult> {
    const filePath = path.parse(file);
    const fileName = filePath.base;
    const data = await fs.readFile(file, 'utf-8');
    return compileSource(data, fileName);
}

export async function compileSource(source: string, fileName: string = 'foo.js'): Promise<ICompilerResult> {
    try {
        const name = fileName.substring(0, fileName.lastIndexOf('.'));
        const options: CompilerOptions = {
            name,
            namespace: 'x',
            files: {},
        };
        const transformerResult = await transform(source, fileName, options);
        const metadata = transformerResult.metadata as Metadata;
        patchComments(metadata);
        return { metadata, diagnostics: [] };
    } catch (err) {
        return { diagnostics: [toDiagnostic(err)] };
    }
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

export function toVSCodeRange(babelRange: SourceLocation): Range {
    // babel (column:0-based line:1-based) => vscode (character:0-based line:0-based)
    return Range.create(Position.create(babelRange.start.line - 1, babelRange.start.column), Position.create(babelRange.end.line - 1, babelRange.end.column));
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

function sanitizeComment(comment: string): string {
    const parsed = commentParser('/*' + comment + '*/');
    return parsed && parsed.length > 0 ? parsed[0].source : null;
}
