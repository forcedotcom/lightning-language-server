module.exports = {
  displayName: 'unit',
  transform: {
      ".ts": "ts-jest"
    },
    testRegex: "\/__tests__\/.*(test|spec)\.(ts|js)$",
    moduleFileExtensions: [
      "ts",
      "js",
      "json"
    ],
    setupTestFrameworkScriptFile: "<rootDir>/jest/matchers.ts",
    testURL: "http://localhost"
};
