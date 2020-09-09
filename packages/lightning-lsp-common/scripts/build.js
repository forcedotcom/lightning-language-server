// eslint-disable-next-line @typescript-eslint/no-var-requires
const shell = require('shelljs');

// Copy typings
if (shell.exec('node scripts/copy_typings.js').code !== 0) {
    shell.echo('Error:node scripts/copy_typings.js couldnt be executed');
    shell.exit(1);
}

//Copy src/resources into lib/
shell.cp('-R', 'src/resources', 'lib/');

// Copy Html Language Service files
// Copy static assets
shell.cp('-R', 'src/html-language-service/beautify', 'lib/html-language-service/beautify');
