export function interceptConsoleLogger(connection) {
    const console = global.console;
    if (!console) return;
    function intercept(method) {
        var original = console[method];
        console[method] = function() {
            if (connection) {
                connection.console[method].apply(connection.console, arguments);
            }

            original.apply(console, arguments);
        };
    }
    var methods = ['log', 'warn', 'error'];
    for (var i = 0; i < methods.length; i++) intercept(methods[i]);
}
