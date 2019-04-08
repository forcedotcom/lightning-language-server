module.exports = {
  displayName: 'unit',
  transform: {
      ".ts": "ts-jest"
    },
    testRegex: 'src/.*(\\.|/)(test|spec)\\.(ts|js)$',
    moduleFileExtensions: [
      "ts",
      "js",
      "json"
    ],
    setupTestFrameworkScriptFile: "<rootDir>/jest/matchers.ts",
    testURL: "http://localhost"
};
