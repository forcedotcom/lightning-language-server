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

    it('handles a full path', async () => {
        const declaration: string = Typing.declaration('./foo/bar/buz/logo.asset-meta.xml');
        const expectedDeclaration: string = `declare module "@salesforce/contentAssetUrl/logo" {
    var logo: string;
    export default logo;
}
`;
        expect(declaration).toEqual(expectedDeclaration);
    });
});

describe('Typing.declarationsFromCustomLabel', () => {
    it('Generates declarations from parsed xml document', async () => {
        const xmlDocument: string = `
<?xml version="1.0" encoding="UTF-8"?>
<CustomLabels xmlns="http://soap.sforce.com/2006/04/metadata">
    <labels>
        <fullName>greeting</fullName>
        <language>en_US</language>
        <protected>true</protected>
        <shortDescription>greeting</shortDescription>
        <value>Aloha!</value>
    </labels>
    <labels>
        <fullName>other_greeting</fullName>
        <language>en_US</language>
        <protected>true</protected>
        <shortDescription>greeting</shortDescription>
        <value>Aloha!</value>
    </labels>
</CustomLabels>
`;

        const expectedDeclaration1: string = `declare module "@salesforce/label/c.greeting" {
    var greeting: string;
    export default greeting;
}
`;

        const expectedDeclaration2: string = `declare module "@salesforce/label/c.other_greeting" {
    var other_greeting: string;
    export default other_greeting;
}
`;

        const declarations: string[] = await Typing.declarationsFromCustomLabels(xmlDocument);
        const expectedDeclarations: string[] = [expectedDeclaration1, expectedDeclaration2];

        expect(declarations).toEqual(expectedDeclarations);
    });
});
