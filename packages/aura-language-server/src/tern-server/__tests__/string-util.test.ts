import {countPreviousCommas, findPreviousLeftParan, findPreviousWord, findWord} from '../string-util'

describe('string-util', () => {
  describe('findWord', () => {
    it('should find start and end of word', () => {
      const testWord = 'test';
      const testString: string = `   ${testWord}   `;
      const result = findWord(testString, testString.length / 2);

      expect(result).toBeDefined();
      expect(result.start).toEqual(testString.indexOf(testWord));
      expect(result.end).toEqual(testString.indexOf(testWord) + testWord.length);
    });

    it('should find start and end of word in multiline string', () => {
      const testWord = 'test';
      const testString: string = '\n\n' + testWord + '\n\n';
      const result = findWord(testString, testString.length / 2);

      expect(result).toBeDefined();
      expect(result.start).toEqual(testString.indexOf(testWord) - 1);
      expect(result.end).toEqual(testString.indexOf(testWord) + testWord.length);
    });
  });

  describe('countPreviousCommas', () => {
    it('should find number of preceding commas', () => {
      const testWord = 'test';
      const commas = ',,,';
      const testString: string = `${commas}${testWord}`;
      const result = countPreviousCommas(testString, commas.length + testString.length / 2);

      expect(result).toBeDefined();
      expect(result).toEqual(commas.length);
    });

    it('should find number of preceding commas with chars between', () => {
      const testWord = 'test';
      const threeCommaString = 'value1, value2, value3, ';
      const testString: string = `${threeCommaString}${testWord}`;
      const result = countPreviousCommas(testString, threeCommaString.length + testString.length / 2);

      expect(result).toBeDefined();
      expect(result).toEqual(3);
    });
  });

  describe('findPreviousLeftParan', () => {
    it('should find index of preceding left bracket', () => {
      const testWord = 'test';
      const testString: string = `(${testWord})`;
      const result = findPreviousLeftParan(testString, testString.length / 2);

      expect(result).toBeDefined();
      expect(result).toEqual(testString.indexOf('('));
    });

    it('should find index of preceding left bracket with chars between', () => {
      const testWord = 'test';
      const testString: string = `func(anotherParameter, ${testWord})`;
      const result = findPreviousLeftParan(testString, testString.length / 2);

      expect(result).toBeDefined();
      expect(result).toEqual(testString.indexOf('('));
    });
  });

  describe('findPreviousWord', () => {
    it('should find start and end of preceding word before "."', () => {
      const testWord = 'test';
      const perviousWord = 'word';
      const testString: string = `   ${perviousWord}.${testWord}   `;
      const result = findPreviousWord(testString, testString.indexOf(testWord) + 2);

      expect(result).toBeDefined();
      expect(result.start).toEqual(testString.indexOf(perviousWord));
      expect(result.end).toEqual(testString.indexOf(perviousWord) + perviousWord.length + 1);
    });
  });
});