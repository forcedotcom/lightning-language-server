import Typing from '../typing';

describe('Typing', () => {
    it('generates the typing declaration for a content asset file.', () => {
        const contentAssetMetaFileName: string = 'logo.asset-meta.xml';

        const expectedDeclaration: string = `declare module "@salesforce/contentAssetUrl/logo" {
    var logo: string;
    export default logo;
}
`;

        const declaration = Typing.declaration(contentAssetMetaFileName);
        expect(declaration).toEqual(expectedDeclaration);
    });
});
