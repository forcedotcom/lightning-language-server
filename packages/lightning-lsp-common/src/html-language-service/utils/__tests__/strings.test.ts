import { startsWith } from '../strings'

describe('strings', () => {
  describe('startsWith', () => {
    it('should return true if string starts with prefix string', () => {
      const testString = 'teststring';
      const testPrefix = 'test';
      expect(startsWith(testString, testPrefix)).toBe(true);
    });

    it('should return false if string does not start with prefix string', () => {
      const testString = 'teststring';
      const testPrefix = 'string';
      expect(startsWith(testString, testPrefix)).toBe(false);
    });

    it('should return false if prefix string is longer than search string', () => {
      const testString = 'test';
      const testPrefix = 'tests';
      expect(startsWith(testString, testPrefix)).toBe(false);
    });
  });
});