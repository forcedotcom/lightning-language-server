// eslint-disable-next-line @typescript-eslint/no-var-requires
const shell = require('shelljs');

// Copy static assets
if (shell.exec('yarn copy-static-assets"').code !== 0) {
    shell.echo('Error:yarn copy-static-assets couldnt be executed');
    shell.exit(1);
}
