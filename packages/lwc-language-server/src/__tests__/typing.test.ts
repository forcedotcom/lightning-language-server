import Typing from '../typing';

describe('Typing.declaration', () => {
    it('generates the typing declaration for a content asset file.', () => {
        const declaration: string = Typing.declaration('logo.asset-meta.xml');
        const expectedDeclaration: string = `declare module "@salesforce/contentAssetUrl/logo" {
    var logo: string;
    export default logo;
}
`;

        expect(declaration).toEqual(expectedDeclaration);
    });

    it('handls a full path', () => {
        const declaration: string = Typing.declaration('logo.asset-meta.xml');
        const expectedDeclaration: string = `declare module "@salesforce/contentAssetUrl/logo" {
    var logo: string;
    export default logo;
}
`;

        expect(declaration).toEqual(expectedDeclaration);
    });

    it('generate the typing declaration for a static resource file', () => {
        const declaration: string = Typing.declaration('d3.resource-meta.xml');
        const expectedDeclaration: string = `declare module "@salesforce/resourceUrl/d3" {
    var d3: string;
    export default d3;
}
`;

        expect(declaration).toEqual(expectedDeclaration);
    });

    it('generate the typing declaration for a message channels file', () => {
        const declaration: string = Typing.declaration('Channel1.messageChannel-meta.xml');
        const expectedDeclaration = `declare module "@salesforce/messageChannel/Channel1__c" {
    var Channel1: string;
    export default Channel1;
}
`;

        expect(declaration).toEqual(expectedDeclaration);
    });

    it('throws an error if the wrong -meta.xml file is passed in', () => {
        const filename: string = 'asset.foobar-meta.xml';
        expect(() => {
            Typing.declaration(filename);
        }).toThrow();
    });

    it('handles a full path', () => {
        const declaration: string = Typing.declaration('./foo/bar/buz/logo.asset-meta.xml');
        const expectedDeclaration: string = `declare module "@salesforce/contentAssetUrl/logo" {
    var logo: string;
    export default logo;
}
`;
        expect(declaration).toEqual(expectedDeclaration);
    });
});
