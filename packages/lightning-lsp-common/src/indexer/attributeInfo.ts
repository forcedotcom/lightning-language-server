import { Location } from 'vscode-languageserver';

export enum MemberType {
    PROPERTY,
    METHOD,
}
export enum Decorator {
    API,
    TRACK,
}
export class AttributeInfo {
    constructor(
        public name: string,
        public documentation: string,
        public memberType: MemberType,
        public decorator: Decorator,
        public type: string,
        public location?: Location,
        public detail?: string,
    ) {}
}
