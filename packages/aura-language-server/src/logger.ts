export function interceptConsoleLogger(connection) {
    const console = global.console;
    if (!console) {
        return;
    }
    function intercept(method) {
        const original = console[method];
        console[method] = function() {
            if (connection) {
                connection.console[method].apply(connection.console, arguments);
            }

            original.apply(console, arguments);
        };
    }
    const methods = ['log', 'warn', 'error'];
    for (const method of methods) {
        intercept(method);
    }
}
