import * as fs from 'fs';
import { transform } from '../resources/lwc/compiler';
import { TextDocument, Diagnostic, DiagnosticSeverity, Range, Location, Position } from 'vscode-languageserver';
import { DIAGNOSTIC_SOURCE } from '../constants';
import * as path from 'path';
import URI from 'vscode-uri';
import { AttributeInfo } from '../html-language-service/parser/htmlTags';

export interface IClassMemberMetadata {
    name: string;
    doc: string;
    loc: { start: { line: number; column: number }; end: { line: number; column: number } };
}

export interface ICompilerMetadata {
    decorators: any;
    classMembers: any;
    doc: string;
    declarationLoc: { start: { line: number; column: number }; end: { line: number; column: number } };
}

export interface ICompilerResult {
    diagnostics?: Diagnostic[];
    result?: { map: { names: string[] }; metadata: ICompilerMetadata };
}

export function getPublicReactiveProperties(metadata: ICompilerMetadata): IClassMemberMetadata[] {
    return getClassMembers(metadata, 'property', 'api');
}

export function getPrivateReactiveProperties(metadata: ICompilerMetadata): IClassMemberMetadata[] {
    return getDecoratorsTargets(metadata, 'track', 'property');
}

export function getApiMethods(metadata: ICompilerMetadata): IClassMemberMetadata[] {
    return getDecoratorsTargets(metadata, 'api', 'method');
}

export function getProperties(metadata: ICompilerMetadata): IClassMemberMetadata[] {
    return getClassMembers(metadata, 'property');
}

export function getMethods(metadata: ICompilerMetadata): IClassMemberMetadata[] {
    return getClassMembers(metadata, 'method');
}

function getDecoratorsTargets(metadata: ICompilerMetadata, elementType: string, targetType: string): IClassMemberMetadata[] {
    const props: IClassMemberMetadata[] = [];
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
    return props;
}

function getClassMembers(metadata: ICompilerMetadata, memberType: string, memberDecorator?: string): IClassMemberMetadata[] {
    const members: IClassMemberMetadata[] = [];
    for (const member of metadata.classMembers) {
        if (member.type === memberType) {
            if (!memberDecorator || member.decorator === memberDecorator) {
                members.push(member);
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
    return compileSource(fs.readFileSync(file, 'utf8'), fileName);
}

export async function compileSource(source: string, fileName: string = 'foo.js'): Promise<ICompilerResult> {
    try {
        // TODO: need proper id/moduleNamespace/moduleName?
        const result = await transform(source, fileName, { moduleNamespace: 'x', moduleName: 'foo' });
        return { result, diagnostics: [] };
    } catch (err) {
        return { diagnostics: [toDiagnostic(err)] };
    }
}

export function extractAttributes(metadata: ICompilerMetadata, uri: string): AttributeInfo[] {
    return getPublicReactiveProperties(metadata).map(x => {
        const location = Location.create(
            uri,
            Range.create(Position.create(x.loc.start.line, x.loc.start.column), Position.create(x.loc.end.line, x.loc.end.column)),
        );
        return new AttributeInfo(x.name, x.doc, location, 'LWC custom attribute');
    });
}

// TODO: proper type for 'err' (i.e. SyntaxError)
function toDiagnostic(err: any): Diagnostic {
    // TODO: 'err' doesn't have end loc, squiggling until the end of the line until babel 7 is released
    const startLine: number = err.loc.line - 1;
    const startCharacter: number = err.loc.column;
    const range: Range = Range.create(startLine, startCharacter, startLine, Number.MAX_VALUE);
    return {
        range,
        severity: DiagnosticSeverity.Error,
        source: DIAGNOSTIC_SOURCE,
        message: err.message,
    };
}
