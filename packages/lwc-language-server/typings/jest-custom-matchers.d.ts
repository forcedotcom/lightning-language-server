declare namespace jest {
    interface Matchers<R> {
        toExist(): R;
        toBeAbsolute(): R;
        toEndWith(suffix: string): R;
    }
}