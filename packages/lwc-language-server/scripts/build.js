#!/usr/bin/env node
// eslint-disable-next-line @typescript-eslint/no-var-requires
const shell = require('shelljs');

//Copy src/resources into lib/
shell.cp('-R', 'src/resources', 'lib/');
