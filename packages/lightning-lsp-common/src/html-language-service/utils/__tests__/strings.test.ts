import { startsWith, endsWith, commonPrefixLength, repeat, isLetterOrDigit } from '../strings'

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

  describe('repeat', () => {
    it('should return repeated string', () => {
      const initialString = 'abc';
      const tripledString = `${initialString}${initialString}${initialString}`;
      expect(repeat(initialString, 3)).toEqual(tripledString);
    });
    
    it('should return original string when count is 1', () => {
      const initialString = 'abc';
      expect(repeat(initialString, 1)).toEqual(initialString);
    });
  });

  describe('isLetterOrDigit', () => {
    const testString = 'a1.';

    it('should return true for letters and digits', () => {
      expect(isLetterOrDigit(testString, 0)).toBe(true);
      expect(isLetterOrDigit(testString, 1)).toBe(true);
    });

    it('should return false for special characters', () => {
      expect(isLetterOrDigit(testString, 2)).toBe(false);
    });
  });
});