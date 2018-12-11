import fs from 'fs';
import * as tern from 'tern';
import path from 'path';

const defaultConfig = {
    libs: ['browser', 'ecmascript'],
    loadEagerly: false,
    plugins: {},
    ecmaScript: true,
    ecmaVersion: 6,
    stripCRs: false,
    disableLoadingLocal: true,
    verbose: true,
    debug:  true,
    async: true,
    dependencyBudget: 20000
};

function readJSON(fileName) {
    const file = fs.readFileSync(fileName, 'utf-8');
    try {
        return JSON.parse(file);
    } catch (e) {
        console.warn("Bad JSON in " + fileName + ": " + e.message);
    }
}

function findDefs(config) {
    const ternlibpath = require.resolve('tern');
    const ternbasedir = path.join( ternlibpath, '../..');

    const defs = [], src = config.libs.slice();
    if (config.ecmaScript && src.indexOf("ecmascript") == -1)
      src.unshift("ecmascript")
    for (let i = 0; i < src.length; ++i) {
        let file = src[i];
        console.log("Loading library " + file);
        if (!/\.json$/.test(file)) file = file + ".json";
        const def = path.join(ternbasedir, 'defs', file);
        if (fs.existsSync(def)) {
            defs.push(readJSON(def));
        } else {
            console.log("Library not found: " + src[i]);
        }
    }
    return defs;
}

export function startServer(rootPath) {
    debugger;

    const config = {
        ...defaultConfig,
        defs: defs,
        plugins: plugins,
        // @ts-ignore 2345
        projectDir: rootPath,
        getFile: function (name, c) {
            if (defaultConfig.async) {
                fs.readFile(path.resolve(rootPath, name), "utf8", c);
            } else {
                return fs.readFileSync(path.resolve(rootPath, name), "utf8");
            }
        }
    };

    var defs = findDefs(config );
    var plugins = undefined;//loadAura();

    var server = new tern.Server(config);
    return server;
}

