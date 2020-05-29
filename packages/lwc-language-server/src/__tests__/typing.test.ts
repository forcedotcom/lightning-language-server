import Typing from '../typing';

describe('Typing', () => {
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
});
