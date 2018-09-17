const fs = require('fs-extra');
const join = require('path').join;

// copies typings files and adds 'declare module "@salesforce/..."'/patches them
// the copied files are added to the user's .sfdx/typings

const destDir = join('src', 'resources', 'sfdx', 'typings', 'copied');
fs.copySync(join('node_modules', 'lwc-engine', 'types', 'engine.d.ts'), join(destDir, 'engine.d.ts'));

for (const pkg of fs.readdirSync(join('node_modules', '@salesforce'))) {
    const inputFile = join('node_modules', '@salesforce', pkg, 'dist', 'types', 'index.d.ts');
    const fd = fs.openSync(join(destDir, pkg + '.d.ts'), 'w');
    fs.writeSync(fd, 'declare module "@salesforce/' + pkg + '" {\n');
    fs.readFileSync(inputFile).toString().split('\n').forEach(function (line) {
        // 'export declare type' conflicts with added 'declare module'
        line = line.replace('export declare type', 'export type');
        fs.writeSync(fd, '    ' + line + '\n');
    });
    fs.writeSync(fd, '}\n');
    fs.close(fd);
}