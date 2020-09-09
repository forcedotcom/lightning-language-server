// eslint-disable-next-line @typescript-eslint/no-var-requires
const shell = require('shelljs');

// Copy static assets
if (shell.exec('yarn copy-static-assets"').code !== 0) {
    shell.echo('Error:yarn copy-static-assets couldnt be executed');
    shell.exit(1);
}

// Copy typings
if (shell.exec('node ./scripts/copy_typings.js"').code !== 0) {
    shell.echo('Error:node ./scripts/copy_typings.js couldnt be executed');
    shell.exit(1);
}

//Copy src/resources into lib/
shell.cp('-R', 'src/resources', 'lib/');
