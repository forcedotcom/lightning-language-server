import { IConnection } from 'vscode-languageserver';

export function interceptConsoleLogger(connection: IConnection) {
    const console = global.console;
    if (!console) {
        return;
    }
    const intercept = (method: string) => {
        const original = console[method];
        // tslint:disable-next-line: only-arrow-functions
        console[method] = function() {
            if (connection) {
                connection.console[method].apply(connection.console, arguments);
            }

            original.apply(console, arguments);
        };
    };
    const methods = ['log', 'warn', 'error'];
    for (const method of methods) {
        intercept(method);
    }
}
