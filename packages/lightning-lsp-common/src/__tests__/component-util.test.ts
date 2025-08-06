import * as componentUtil from '../component-util';

describe('component-util.ts', () => {
    describe('moduleFromFile', () => {
        it('returns null if filename doesnt match parent folder name', () => {
            const value = componentUtil.moduleFromFile('lwc/card/foo.js', true);
            expect(value).toBeNull();
        });

        it('uses c namespace when in sfdx project', () => {
            const value = componentUtil.moduleFromFile('lwc/card/card.js', true);
            expect(value).toBe('c/card');
        });

        it('uses folder namespace when not in sfdx project', () => {
            const value = componentUtil.moduleFromFile('lightning/card/card.js', false);
            expect(value).toBe('lightning/card');
        });

        it('uses camelCase (does not convert to kebab-case)', () => {
            const value = componentUtil.moduleFromFile('lwc/myCard/myCard.js', true);
            expect(value).toBe('c/myCard');
        });

        it('treats interop as lightning', () => {
            const value = componentUtil.moduleFromFile('interop/myCard/myCard.js', false);
            expect(value).toBe('lightning/myCard');
        });
    });

    describe('moduleFromDirectory', () => {
        it('uses c namespace when in sfdx project', () => {
            const value = componentUtil.moduleFromDirectory('lwc/card', true);
            expect(value).toBe('c/card');
        });

        it('uses folder namespace when not in sfdx project', () => {
            const value = componentUtil.moduleFromDirectory('lightning/card', false);
            expect(value).toBe('lightning/card');
        });

        it('uses camelCase (does not convert to kebab-case)', () => {
            const value = componentUtil.moduleFromDirectory('lwc/myCard', true);
            expect(value).toBe('c/myCard');
        });

        it('treats interop as lightning', () => {
            const value = componentUtil.moduleFromDirectory('interop/myCard', false);
            expect(value).toBe('lightning/myCard');
        });
    });
});
