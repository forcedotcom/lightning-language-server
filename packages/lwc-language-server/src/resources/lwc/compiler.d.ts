export function transform(src: string, id: string, options: object): any;

export interface Config {
    computedMemberExpression?: boolean;
}

export interface CompilationWarning {
    message: string;
    start: number;
    length: number;
    level: WarningLevel;
}

export type WarningLevel = 'info' | 'warning' | 'error';

export function templateCompiler(source: string, config: Config): {
    code: string;
    warnings: CompilationWarning[];
};