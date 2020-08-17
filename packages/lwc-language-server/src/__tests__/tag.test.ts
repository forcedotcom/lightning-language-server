import Tag from '../tag';

describe('Tag', () => {
    const filepath = './src/javascript/__tests__/fixtures/metadata.js';

    describe('.new', () => {
        const tag = new Tag({
            file: filepath,
        });

        it('returns a new Tag', () => {
            expect(tag.file).toEqual(filepath);
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
                expect(tag.classMember('todo')).not.toBeNull();
                expect(tag.classMember('index')).not.toBeNull();
                expect(tag.classMember('foo')).toBeNull();
            });
        });

        describe('#classMemberLocation', () => {
            it('returns a classMember of a Tag by name', () => {
                const location = tag.classMemberLocation('todo');
                expect(location.uri).toContain('metadata.js');
                expect(location.range.start.line).toEqual(4);
                expect(location.range.start.character).toEqual(4);

                expect(tag.classMemberLocation('index').uri).toContain('metadata.js');
                expect(tag.classMemberLocation('foo')).toBeNull();
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

        describe('#allLocations', () => {
            it('returns multiple files if present', () => {
                const allLocations = tag.allLocations;
                expect(allLocations.length).toEqual(3);
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
            it('returns the filename for the component', () => {
                expect(tag.name).toEqual('metadata');
            });
        });

        describe('#lwcTypingsName', () => {
            it('returns the lwc import name for the component', () => {
                expect(tag.lwcTypingsName).toEqual('c/metadata');
            });
        });

        describe('#auraName', () => {
            it('returns the name for the lwc component when referenced in an aura component', () => {
                expect(tag.auraName).toEqual('c:metadata');
            });
        });

        describe('#lwcName', () => {
            it('returns the name for the component when referenced in another lwc component', () => {
                expect(tag.lwcName).toEqual('c-metadata');
            });
        });

        describe('#attribute', () => {
            it('finds the attribute by name', () => {
                expect(tag.attribute('index'));
            });

            it('returns null when not found', () => {
                expect(tag.attribute('foo')).toBeNull();
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
