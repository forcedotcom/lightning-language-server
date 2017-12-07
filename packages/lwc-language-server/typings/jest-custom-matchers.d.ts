declare namespace jest {
    interface Matchers<R> {
        toBeAbsolute(): R;
        toEndWith(suffix: string): R;
    }
}