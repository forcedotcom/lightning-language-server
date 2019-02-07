declare namespace jest {
    interface Matchers<R> {
        toExist(): R;
        toBeAbsolutePath(): R;
        toEndWith(suffix: string): R;
    }
}
