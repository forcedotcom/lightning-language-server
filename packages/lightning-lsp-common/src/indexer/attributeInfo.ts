import { Location } from 'vscode-languageserver';

export class AttributeInfo {
    constructor(public name: string, public documentation: string, public type: string, public location?: Location, public detail?: string) {}
}
