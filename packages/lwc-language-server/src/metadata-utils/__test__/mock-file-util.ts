export interface IFileUtilMockHooks {
    writeCallback: (path: string, callback: () => string) => Promise<void>;
}

export const mockFileUtilHooks: IFileUtilMockHooks = { writeCallback: undefined };
export function mockFileUtil() {
    return {
        write: jest.fn((path: string, callback: () => string) => {
            if (mockFileUtilHooks.writeCallback) {
                mockFileUtilHooks.writeCallback(path, callback);
            }
        }),
    };
}
