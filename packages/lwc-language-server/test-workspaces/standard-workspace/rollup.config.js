/* eslint-env node */

const path = require('path');
const lwcCompiler = require('rollup-plugin-lwc-compiler');

module.exports = {
    input: path.resolve('src/main.js'),
    output: {
        file: path.resolve('static/js/main.js'),
        format: 'iife',
    },
    external: ['engine'],
    globals: { engine: 'Engine' },
    plugins: [
        lwcCompiler({
            mapNamespaceFromPath: true,
            resolveFromPackages: false,
        })
    ]
};
