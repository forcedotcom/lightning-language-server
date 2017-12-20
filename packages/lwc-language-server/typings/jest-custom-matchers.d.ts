declare namespace jest {
    interface Matchers<R> {
        fileToExist(): R;
        pathToBeAbsolute(): R;
        toEndWith(suffix: string): R;
    }
}