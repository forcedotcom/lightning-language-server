import { Location } from 'vscode-languageserver';

export type AttributeInfo = {
    name: string;
    documentation: string;
    memberType: MemberType;
    decorator: DecoratorType;
    type: string;
    location?: Location;
    detail?: string;
};

export type MemberType = 'PROPERTY' | 'METHOD';

export type DecoratorType = 'API' | 'TRACK';

// Factory function to replace constructor usage
export const createAttributeInfo = (
    name: string,
    documentation: string,
    memberType: MemberType,
    decorator: DecoratorType,
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
