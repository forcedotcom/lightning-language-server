#!/usr/bin/env node
const fs = require('fs-extra');
const { join, resolve } = require('path');
var findNodeModules = require('find-node-modules');
// the copied files are added to the user's .sfdx/typings

// copy engine.d.ts file from node_modules
const destDir = resolve(join(__dirname, '..', 'src', 'resources', 'sfdx', 'typings', 'copied'));
fs.copySync(join(require.resolve('@lwc/engine'), '../../../..', 'types', 'engine.d.ts'), join(destDir, 'engine.d.ts'));

const modules = findNodeModules();
// copy @salesforce typings from node_modules
for (const mod of modules) {
    const salesforce = join(mod, '@salesforce');
    if (fs.pathExistsSync(salesforce)) {
        for (const pkg of fs.readdirSync(salesforce)) {
            const inputFile = join(salesforce, pkg, 'dist', 'types', 'index.d.ts');
            if (fs.existsSync(inputFile)) {
                fs.copySync(inputFile, join(destDir, pkg + '.d.ts'));
            }
        }
    }
}
