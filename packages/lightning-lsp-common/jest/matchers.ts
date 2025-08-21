import { isAbsolute } from 'path';
import * as fs from 'fs';

declare global {
    // eslint-disable-next-line @typescript-eslint/no-namespace
    namespace jest {
        interface Matchers<R> {
            toExist(): R;
            toBeAbsolutePath(): R;
            toEndWith(suffix: string): R;
        }
    }
}

expect.extend({
    toExist(path) {
        const pass = fs.existsSync(path);
        if (pass) {
            return {
                message: () => `expected ${path} not to exist`,
                pass: true,
            };
        } else {
            return {
                message: () => `expected ${path} to exist`,
                pass: false,
            };
        }
    },
    toBeAbsolutePath(path) {
        const pass = isAbsolute(path);
        if (pass) {
            return {
                message: () => `expected ${path} not to be absolute`,
                pass: true,
            };
        } else {
            return {
                message: () => `expected ${path} to be absolute`,
                pass: false,
            };
        }
    },
    toEndWith(path: string, suffix: string) {
        const pass = path.endsWith(suffix);
        if (pass) {
            return {
                message: () => `expected ${path} not to end with ${suffix}`,
                pass: true,
            };
        } else {
            return {
                message: () => `expected ${path} to end with ${suffix}`,
                pass: false,
            };
        }
    },
});
