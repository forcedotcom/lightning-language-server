import { SourceLocation } from 'babel-types';
import * as path from 'path';
import { Diagnostic, DiagnosticSeverity, Location, Position, Range, TextDocument } from 'vscode-languageserver';
import URI from 'vscode-uri';
import { DIAGNOSTIC_SOURCE } from '../constants';
import { AttributeInfo } from '../html-language-service/parser/htmlTags';
import { transform } from 'lwc-compiler';
import { CompilerOptions } from 'lwc-compiler/dist/types/compiler/options';
import { ClassMember } from 'babel-plugin-transform-lwc-class';
import * as utils from '../utils';
import { Metadata } from 'babel-plugin-transform-lwc-class';
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
    const file = URI.parse(document.uri).fsPath;
    const filePath = path.parse(file);
    const fileName = filePath.base;
    return compileSource(document.getText(), fileName);
}

export async function compileFile(file: string): Promise<ICompilerResult> {
    const filePath = path.parse(file);
    const fileName = filePath.base;
    return compileSource(utils.readFileSync(file), fileName);
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

export function extractAttributes(metadata: Metadata, uri: string): AttributeInfo[] {
    return getPublicReactiveProperties(metadata).map(x => {
        const location = Location.create(uri, toVSCodeRange(x.loc));
        return new AttributeInfo(x.name, x.doc, location, 'LWC custom attribute');
    });
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
    const range = Range.create(startLine, startCharacter, startLine, Number.MAX_VALUE);
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
