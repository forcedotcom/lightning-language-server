import Typing from '../typing';

describe('Typing.declaration', () => {
    it('throws an error if the wrong -meta.xml file is passed in', () => {
        const badFilename = 'asset.foobar-meta.xml';
        expect(() => {
            Typing.declaration(badFilename);
        }).toThrow();
    });

    it('generates the typing declaration for a content asset file.', () => {
        const contentAssetMetaFilename: string = 'logo.asset-meta.xml';
        const expectedDeclaration: string = `declare module "@salesforce/contentAssetUrl/logo" {
    var logo: string;
    export default logo;
}
`;

        expect(Typing.declaration(contentAssetMetaFilename)).toEqual(expectedDeclaration);
    });

    it('generate the typing declaration for a static resource file', () => {
        const staticResourceMetaFilename: string = 'd3.resource-meta.xml';
        const expectedDeclaration: string = `declare module "@salesforce/resourceUrl/d3" {
    var d3: string;
    export default d3;
}
`;

        expect(Typing.declaration(staticResourceMetaFilename)).toEqual(expectedDeclaration);
    });

    it('generate the typing declaration for a message channels file', () => {
        const staticResourceMetaFilename: string = 'Channel1.messageChannel-meta.xml';
        const expectedDeclaration = `declare module "@salesforce/messageChannel/Channel1__c" {
    var Channel1: string;
    export default Channel1;
}
`;

        expect(Typing.declaration(staticResourceMetaFilename)).toEqual(expectedDeclaration);
    });
});
