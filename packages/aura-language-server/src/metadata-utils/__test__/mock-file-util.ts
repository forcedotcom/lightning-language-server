export interface IFileUtilMockHooks {
    writeContents: (path: string, contents: string) => void;
}

export const mockFileUtilHooks: IFileUtilMockHooks = { writeContents: undefined };
export function mockFileUtil() {
    return {
        writeFileSync: jest.fn((path: string, contents: string) => {
            if (mockFileUtilHooks.writeContents) {
                mockFileUtilHooks.writeContents(path, contents);
            }
        }),
    };
}
