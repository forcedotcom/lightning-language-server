import { Location } from 'vscode-languageserver';

export class AttributeInfo {
    public name: string;
    constructor(public jsName: string, public documentation: string, public type: string, public location?: Location, public detail?: string) {
        // this.name = jsName.replace(/([A-Z])/g, (match: string) => `-${match.toLowerCase()}`);
        this.name = jsName;
    }
}
