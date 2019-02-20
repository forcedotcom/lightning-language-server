import fs from 'fs';
import * as tern from 'tern';
import path from 'path';

const defaultLibs = ['browser', 'ecmascript'];
const defaultPlugins = { modules: {}, aura: {}, doc_comment: {} };

const defaultConfig = {
    ecmaVersion: 6,
    stripCRs: false,
    disableLoadingLocal: true,
    verbose: true,
    debug: true,
    async: true,
    dependencyBudget: 20000,
};

function readJSON(fileName) {
    const file = fs.readFileSync(fileName, 'utf-8');
    try {
        return JSON.parse(file);
    } catch (e) {
        console.warn('Bad JSON in ' + fileName + ': ' + e.message);
    }
}

function findDefs(libs) {
    const ternlibpath = require.resolve('tern');
    const ternbasedir = path.join(ternlibpath, '../..');

    const defs = [];
    const src = libs.slice();
    for (let file of src) {
        console.log(`Loading support library: ${file}`);
        if (!/\.json$/.test(file)) {
            file = file + '.json';
        }
        const def = path.join(ternbasedir, 'defs', file);
        if (fs.existsSync(def)) {
            defs.push(readJSON(def));
        } else {
            console.log(`Not found: ${file}`);
        }
    }
    return defs;
}

async function loadPlugins(plugins, rootPath) {
    const options = {};
    for (const plugin of Object.keys(plugins)) {
        const val = plugins[plugin];
        if (!val) {
            continue;
        }

        if (!(await loadLocal(plugin, rootPath))) {
            if (!(await loadBuiltIn(plugin, rootPath))) {
                process.stderr.write('Failed to find plugin ' + plugin + '.\n');
            }
        }

        options[path.basename(plugin)] = true;
    }

    return options;
}

async function loadLocal(plugin, rootPath) {
    let found;
    try {
        // local resolution only here
        found = require.resolve('./tern-' + plugin);
    } catch (e) {
        return false;
    }

    const mod = await import(found);
    if (mod.hasOwnProperty('initialize')) {
        mod.initialize(rootPath);
    }
    return true;
}

async function loadBuiltIn(plugin: string, rootPath: string) {
    const ternlibpath = require.resolve('tern');
    const ternbasedir = path.join(ternlibpath, '../..');

    const def = path.join(ternbasedir, 'plugin', plugin);

    let found: string;
    try {
        // local resolution only here
        found = require.resolve(def);
    } catch (e) {
        process.stderr.write('Failed to find plugin ' + plugin + '.\n');
        return false;
    }

    const mod = await import(found);
    if (mod.hasOwnProperty('initialize')) {
        mod.initialize(rootPath);
    }
    return true;
}

export async function startServer(rootPath: string) {
    const defs = findDefs(defaultLibs);
    const plugins = await loadPlugins(defaultPlugins, rootPath);

    const config: tern.ConstructorOptions = {
        ...defaultConfig,
        defs,
        plugins,
        // @ts-ignore 2345
        projectDir: rootPath,
        getFile(filename: string, callback: (error: Error | undefined, content?: string) => void): void {
            fs.readFile(path.resolve(rootPath, filename), 'utf8', callback);
        },
    };

    const server = new tern.Server(config);
    return server;
}
