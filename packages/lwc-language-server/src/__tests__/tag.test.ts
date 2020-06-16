import Tag from '../tag';
import { ClassMember } from '@lwc/babel-plugin-component';

describe('Tag', () => {
    const filepath = './src/javascript/__tests__/fixtures/metadata.js';

    describe('.new', () => {
        const tag = new Tag({
            file: 'file',
            type: 'type',
            attributes: [],
        });

        it('returns a new Tag', () => {
            expect(tag.file).toEqual('file');
        });
    });

    describe('.fromFile', () => {
        it('creates a tag from a lwc .js file', async () => {
            const tag: Tag = await Tag.fromFile(filepath);

            expect(tag.file).toEqual(filepath);
            expect(tag.metadata.decorators);
            expect(tag.metadata.doc);
            expect(tag.metadata.classMembers);
        });
    });

    describe('instance methods', () => {
        let tag: Tag;

        beforeEach(async () => {
            tag = await Tag.fromFile(filepath);
        });

        describe('#classMembers', () => {
            it('returns methods, properties, attributes. Everything defined on the component', () => {
                expect(tag.classMembers).not.toBeEmpty();
                expect(tag.classMembers[0].name).toEqual('todo');
                expect(tag.classMembers[0].type).toEqual('property');
            });
        });

        describe('#classMember', () => {
            it('returns a classMember of a Tag by name', () => {
                expect(tag.classMember('todo'));
                expect(tag.classMember('index'));
                expect(tag.classMember('foo')).toBeNull();
            });
        });

        describe('#publicAttributes', () => {
            it('returns the public attributes', async () => {
                expect(tag.publicAttributes[0].decorator);
                expect(tag.publicAttributes[0].detail);
                expect(tag.publicAttributes[0].location);
            });
        });

        describe('#privateAttributes', () => {
            it('returns the private attributes', async () => {
                expect(tag.privateAttributes[0].decorator);
                expect(tag.privateAttributes[0].detail);
                expect(tag.privateAttributes[0].location);
            });
        });

        describe('#range', () => {
            it('returns a range for the component', () => {
                const range = { end: { character: 1, line: 30 }, start: { character: 0, line: 2 } };
                expect(tag.range).toEqual(range);
            });
        });

        describe('#location', () => {
            it('returns a location for the component', () => {
                const location = {
                    range: tag.range,
                    uri: tag.uri,
                };
                expect(tag.location).toEqual(location);
            });
        });

        describe('#properties', () => {
            it('returns a properties for the component', () => {
                expect(tag.properties[0].decorator).toEqual('api');
                expect(tag.properties[0].name).toEqual('todo');
            });
        });

        describe('#methods', () => {
            it('returns a methods for the component', () => {
                expect(tag.methods[0].name).toEqual('onclickAction');
            });
        });

        describe('#name', () => {
            it('returns the namespace and the filename for the component', () => {
                expect(tag.name).toEqual('c-metadata');
            });
        });

        describe('#attributeDocs', () => {
            it('returns public attributes formatted in markdown', () => {
                const attributeDocs = `### Attributes
- **todo**
- **index**
- **index-same-line**`;

                expect(tag.attributeDocs).toEqual(attributeDocs);
            });
        });

        describe('#methodDocs', () => {
            it('returns `api` method docs formatted in markdown', () => {
                const attributeDocs = `### Attributes
- **todo**
- **index**
- **index-same-line**`;

                expect(tag.attributeDocs).toEqual(attributeDocs);
            });
        });

        describe('#description', () => {
            it('return markdown of component\'s documentation', () => {
                const description = `Foo doc
### Attributes
- **todo**
- **index**
- **index-same-line**
### Methods
- **apiMethod()**`;
                expect(tag.description).toEqual(description);
            });
        });
    });
});
