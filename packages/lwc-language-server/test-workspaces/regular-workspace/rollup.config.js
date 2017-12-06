/* eslint-env node */

const path = require('path');
const raptorCompiler = require('rollup-plugin-raptor-compiler');

module.exports = {
    input: path.resolve('src/main.js'),
    output: {
        file: path.resolve('static/js/main.js'),
        format: 'iife',
    },
    external: ['engine'],
    globals: { engine: 'Engine' },
    plugins: [
        raptorCompiler({
            mapNamespaceFromPath: true,
            resolveFromPackages: false,
        })
    ]
};
