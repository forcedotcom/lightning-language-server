import { IConnection } from 'vscode-languageserver';

export function interceptConsoleLogger(connection: IConnection) {
    const console: any = global.console;
    if (!console) {
        return;
    }
    const intercept = (method: string) => {
        const original = console[method];
        // tslint:disable-next-line: only-arrow-functions
        console[method] = function(...args: any) {
            if (connection) {
                const remote: any = connection.console;
                remote[method].apply(connection.console, args);
            }

            original.apply(console, args);
        };
    };
    const methods = ['log', 'info', 'warn', 'error'];
    for (const method of methods) {
        intercept(method);
    }
}
