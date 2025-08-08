import { TextDocument, Position } from 'vscode-languageserver';
import { getAuraBindingValue, parse } from '../aura-utils';

describe('getAuraBindingValueNew', () => {
    function createDocument(content: string): TextDocument {
        return TextDocument.create('file:///test.cmp', 'html', 0, content);
    }

    function createPosition(line: number, character: number): Position {
        return Position.create(line, character);
    }

    function getBindingValue(content: string, line: number, character: number): string | null {
        const document = createDocument(content);
        const htmlDocument = parse(content);
        const position = createPosition(line, character);
        return getAuraBindingValue(document, position, htmlDocument);
    }

    describe('basic functionality', () => {
        it('should extract property from v binding in attribute', () => {
            const content = '<div value="{!v.property}"></div>';
            const result = getBindingValue(content, 0, 15); // Position after "property"
            expect(result).toBe('property');
        });

        it('should extract property from c binding in attribute', () => {
            const content = '<div onclick="{!c.handleClick}"></div>';
            const result = getBindingValue(content, 0, 20); // Position after "handleClick"
            expect(result).toBe('handleClick');
        });

        it('should extract property from m binding in attribute', () => {
            const content = '<div data="{!m.dataValue}"></div>';
            const result = getBindingValue(content, 0, 18); // Position after "dataValue"
            expect(result).toBe('dataValue');
        });

        it('should return null when cursor is before dot', () => {
            const content = '<div value="{!v.property}"></div>';
            const result = getBindingValue(content, 0, 12); // Position at "v"
            expect(result).toBeNull();
        });

        it('should handle quoted attribute values', () => {
            const content = '<div value="\'{!v.property}\'"></div>';
            const result = getBindingValue(content, 0, 17); // Position after "property"
            expect(result).toBe('property');
        });

        it('should handle double quoted attribute values', () => {
            const content = '<div value=\'"{!v.property}"\'></div>';
            const result = getBindingValue(content, 0, 17); // Position after "property"
            expect(result).toBe('property');
        });

        it('should return null for non-binding attributes', () => {
            const content = '<div class="some-class"></div>';
            const result = getBindingValue(content, 0, 12); // Position in "some-class"
            expect(result).toBeNull();
        });
    });

    describe('body text bindings', () => {
        it('should extract property from v binding in body text', () => {
            const content = '<div>{!v.property}</div>';
            const result = getBindingValue(content, 0, 12); // Position after "property"
            expect(result).toBe('property');
        });

        it('should extract property from c binding in body text', () => {
            const content = '<div>{!c.method}</div>';
            const result = getBindingValue(content, 0, 11); // Position after "method"
            expect(result).toBe('method');
        });

        it('should extract property from m binding in body text', () => {
            const content = '<div>{!m.data}</div>';
            const result = getBindingValue(content, 0, 10); // Position after "data"
            expect(result).toBe('data');
        });

        it('should return null when cursor is before dot in body text', () => {
            const content = '<div>{!v.property}</div>';
            const result = getBindingValue(content, 0, 8); // Position at "v"
            expect(result).toBeNull();
        });

        it('should handle multiple bindings in body text', () => {
            const content = '<div>{!v.first} and {!v.second}</div>';
            const result = getBindingValue(content, 0, 11); // Position after "first"
            expect(result).toBe('first');
        });
    });

    describe('edge cases', () => {
        it('should return null for empty document', () => {
            const result = getBindingValue('', 0, 0);
            expect(result).toBeNull();
        });

        it('should return null for invalid HTML', () => {
            const result = getBindingValue('<div>', 0, 0);
            expect(result).toBeNull();
        });

        it('should return null when cursor is outside any node', () => {
            const content = '<div>{!v.property}</div>';
            const result = getBindingValue(content, 1, 0); // Position on new line
            expect(result).toBeNull();
        });

        it('should handle expressions with special characters in property names', () => {
            const content = '<div value="{!v.property_name}"></div>';
            const result = getBindingValue(content, 0, 18); // Position after "property_name"
            expect(result).toBe('property_name');
        });

        it('should handle expressions with numbers in property names', () => {
            const content = '<div value="{!v.property123}"></div>';
            const result = getBindingValue(content, 0, 16); // Position after "property123"
            expect(result).toBe('property123');
        });

        it('should return null for incomplete expressions', () => {
            const content = '<div value="{!v.}"></div>';
            const result = getBindingValue(content, 0, 12); // Position after dot
            expect(result).toBeNull();
        });
    });

    describe('complex scenarios', () => {
        it('should handle multiple attributes with bindings', () => {
            const content = '<div value="{!v.property}" onclick="{!c.method}"></div>';
            const result = getBindingValue(content, 0, 15); // Position after "property"
            expect(result).toBe('property');
        });

        it('should handle self-closing tags with bindings', () => {
            const content = '<input value="{!v.property}" />';
            const result = getBindingValue(content, 0, 18); // Position after "property"
            expect(result).toBe('property');
        });

        it('should handle expressions with comments', () => {
            const content = '<div value="{!v.property}<!-- comment -->"></div>';
            const result = getBindingValue(content, 0, 15); // Position after "property"
            expect(result).toBe('property');
        });
    });

    describe('advanced scenarios', () => {
        it('should handle nested properties', () => {
            const content = '<div value="{!v.object.property}"></div>';
            const result = getBindingValue(content, 0, 22); // Position after "property"
            expect(result).toBe('object'); // Function returns first property in regex group
        });

        it('should handle expressions with multiple dots', () => {
            const content = '<div value="{!v.object.subObject.property}"></div>';
            const result = getBindingValue(content, 0, 26); // Position after "property"
            expect(result).toBe('object'); // Function returns first property in regex group
        });

        it('should handle negated expressions', () => {
            const content = '<div hidden="{!!v.isHidden}"></div>';
            const result = getBindingValue(content, 0, 19); // Position after "isHidden"
            expect(result).toBe('isHidden');
        });
    });

    describe('function behavior summary', () => {
        it('should demonstrate the function\'s core behavior', () => {
            // This test documents what the function actually does
            const testCases = [
                { content: '<div value="{!v.property}"></div>', position: [0, 15], expected: 'property', description: 'Basic v binding' },
                { content: '<div onclick="{!c.method}"></div>', position: [0, 20], expected: 'method', description: 'Basic c binding' },
                { content: '<div data="{!m.data}"></div>', position: [0, 18], expected: 'data', description: 'Basic m binding' },
                { content: '<div>{!v.property}</div>', position: [0, 12], expected: 'property', description: 'Body text binding' },
                { content: '<div value="{!v.object.property}"></div>', position: [0, 22], expected: 'object', description: 'Nested property (returns first)' },
                { content: '<div hidden="{!!v.isHidden}"></div>', position: [0, 19], expected: 'isHidden', description: 'Negated expression' },
            ];

            testCases.forEach(({ content, position, expected, description }) => {
                const result = getBindingValue(content, position[0], position[1]);
                expect(result).toBe(expected);
            });
        });
    });
}); 