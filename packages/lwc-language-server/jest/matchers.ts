import { isAbsolute } from 'path';

expect.extend({
    toBeAbsolute(path) {
        const pass = isAbsolute(path);
        if (pass) {
            return {
                message: () =>
                    `expected ${path} not to be absolute`,
                pass: true,
            };
        } else {
            return {
                message: () => `expected ${path} to be absolute`,
                pass: false,
            };
        }
    },
    toEndWith(str, suffix) {
        const pass = str.endsWith(suffix);
        if (pass) {
            return {
                message: () =>
                    `expected ${str} not to end with ${suffix}`,
                pass: true,
            };
        } else {
            return {
                message: () => `expected ${str} to end with ${suffix}`,
                pass: false,
            };
        }
    },
});
