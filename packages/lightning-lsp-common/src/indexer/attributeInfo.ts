import { Location } from 'vscode-languageserver';

export type MemberType = 'PROPERTY' | 'METHOD';

export type DecoratorType = 'API' | 'TRACK';

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
