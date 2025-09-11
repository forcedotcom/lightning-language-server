import { Location } from 'vscode-languageserver';

export const MemberTypes = {
    PROPERTY: 'PROPERTY',
    METHOD: 'METHOD',
};

export type MemberType = (typeof MemberTypes)[keyof typeof MemberTypes];

export const Decorators = {
    API: 'API',
    TRACK: 'TRACK',
};

export type DecoratorType = (typeof Decorators)[keyof typeof Decorators];

export class AttributeInfo {
    constructor(
        public name: string,
        public documentation: string,
        public memberType: MemberType,
        public decorator: DecoratorType,
        public type: string,
        public location?: Location,
        public detail?: string,
    ) {}
}
