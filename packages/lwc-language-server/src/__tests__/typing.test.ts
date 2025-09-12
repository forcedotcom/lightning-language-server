import Typing from '../typing';
import * as path from 'path';

describe('new Typing', () => {
    it('cannot create a Typing with an invalid type', () => {
        expect(
            () =>
                new Typing({
                    name: 'logo',
                    type: 'invalidType',
                }),
        ).toThrow();
    });

    it('cannot create a Typing with an invalid meta file', () => {
        const filename = 'asset.foobar-meta.xml';
        expect(() => {
            Typing.fromMeta(filename);
        }).toThrow();
    });
});

describe('Typing.declaration', () => {
    it('generates the typing declaration for a content asset file.', () => {
        const typing: Typing = Typing.fromMeta('logo.asset-meta.xml');
        const expectedDeclaration = `declare module "@salesforce/contentAssetUrl/logo" {
    var logo: string;
    export default logo;
}`;

        expect(typing.declaration).toEqual(expectedDeclaration);
    });

    it('generate the typing declaration for a static resource file', () => {
        const typing: Typing = Typing.fromMeta('d3.resource-meta.xml');
        const expectedDeclaration = `declare module "@salesforce/resourceUrl/d3" {
    var d3: string;
    export default d3;
}`;

        expect(typing.declaration).toEqual(expectedDeclaration);
    });

    it('generate the typing declaration for a message channels file', () => {
        const typing: Typing = Typing.fromMeta('Channel1.messageChannel-meta.xml');
        const expectedDeclaration = `declare module "@salesforce/messageChannel/Channel1__c" {
    var Channel1: string;
    export default Channel1;
}`;

        expect(typing.declaration).toEqual(expectedDeclaration);
    });

    it('handles a full path', async () => {
        const typing: Typing = Typing.fromMeta(path.join('.', 'foo', 'bar', 'buz', 'logo.asset-meta.xml'));
        const expectedDeclaration = `declare module "@salesforce/contentAssetUrl/logo" {
    var logo: string;
    export default logo;
}`;
        expect(typing.declaration).toEqual(expectedDeclaration);
    });
});

describe('Typing.fromCustomLabels', () => {
    it('Generates declarations from parsed xml document', async () => {
        const xmlDocument = `
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

        const expectedDeclaration1 = `declare module "@salesforce/label/c.greeting" {
    var greeting: string;
    export default greeting;
}`;

        const expectedDeclaration2 = `declare module "@salesforce/label/c.other_greeting" {
    var other_greeting: string;
    export default other_greeting;
}`;

        const typings: string = await Typing.declarationsFromCustomLabels(xmlDocument);
        const expectedDeclarations: string = [expectedDeclaration1, expectedDeclaration2].join('\n');

        expect(typings).toEqual(expectedDeclarations);
    });

    it('should not generate declarations when parsing an empty labels xml document', async () => {
        const xmlDocument = `
<?xml version="1.0" encoding="UTF-8"?>
<CustomLabels xmlns="http://soap.sforce.com/2006/04/metadata"/>
`;

        const typings: string = await Typing.declarationsFromCustomLabels(xmlDocument);
        expect(typings).toEqual('');
    });
});
