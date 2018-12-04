const fs = require('fs-extra');
const join = require('path').join;

// the copied files are added to the user's .sfdx/typings

// copy engine.d.ts file from node_modules
const destDir = join('src', 'resources', 'sfdx', 'typings', 'copied');
fs.copySync(join('node_modules', '@lwc', 'engine', 'types', 'engine.d.ts'), join(destDir, 'engine.d.ts'));

// copy @salesforce typings from node_modules
for (const pkg of fs.readdirSync(join('node_modules', '@salesforce'))) {    
    const inputFile = join('node_modules', '@salesforce', pkg, 'dist', 'types', 'index.d.ts');
    if (fs.existsSync(inputFile)) {
        fs.copySync(inputFile, join(destDir, pkg + '.d.ts'));
    }
}