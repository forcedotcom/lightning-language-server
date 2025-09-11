import { Location } from 'vscode-languageserver';

export enum MemberType {
    PROPERTY,
    METHOD,
}
export enum Decorator {
    API,
    TRACK,
}
export type AttributeInfo = {
    name: string;
    documentation: string;
    memberType: MemberType;
    decorator: Decorator;
    type: string;
    location?: Location;
    detail?: string;
};

// Factory function to replace constructor usage
export const createAttributeInfo = (
    name: string,
    documentation: string,
    memberType: MemberType,
    decorator: Decorator,
    type: string,
    location?: Location,
    detail?: string,
): AttributeInfo => ({
    name,
    documentation,
    memberType,
    decorator,
    type,
    location,
    detail,
});
