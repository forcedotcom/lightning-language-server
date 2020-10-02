import { startsWith, endsWith, commonPrefixLength, repeat } from '../strings'

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

  describe('endsWith', () => {
    it('should return true if string starts with suffix string', () => {
      const testString = 'teststring';
      const testSuffix = 'string';
      expect(endsWith(testString, testSuffix)).toBe(true);
    });
    
    it('should return false if string does not start with suffix string', () => {
      const testString = 'teststring';
      const testSuffix = 'test';
      expect(endsWith(testString, testSuffix)).toBe(false);
    });

    it('should return false if suffix string is longer than search string', () => {
      const testString = 'test';
      const testSuffix = 'tests';
      expect(endsWith(testString, testSuffix)).toBe(false);
    });
  });

  describe('commonPrefixLength', () => {
    it('should return length of common prefix', () => {
      const commonPrefix = 'abc';
      const stringA = `${commonPrefix}123`;
      const stringB = `${commonPrefix}xyz`;
      expect(commonPrefixLength(stringA, stringB)).toEqual(commonPrefix.length);
    });
    
    it('should return length of smaller string if strings match', () => {
      const commonPrefix = 'abc';
      const stringA = `${commonPrefix}`;
      const stringB = `${commonPrefix}xyz`;
      expect(commonPrefixLength(stringA, stringB)).toEqual(commonPrefix.length);
    });
  });
});