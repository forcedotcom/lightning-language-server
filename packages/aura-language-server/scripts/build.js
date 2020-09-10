#!/usr/bin/env node
// eslint-disable-next-line @typescript-eslint/no-var-requires
const shell = require('shelljs');

// Copy static assets
shell.cp('-R', 'src/tern-server/*.json', 'lib/tern-server/');
shell.mkdir('-p', 'lib/resources/');
shell.cp('-R', 'src/resources/*.json', 'lib/resources/');
// copy tern
shell.rm('-Rf', 'lib/tern');
shell.mkdir('-p', 'lib/tern/');
shell.cp('-R', 'src/tern/lib', 'lib/tern/lib/');
shell.cp('-R', 'src/tern/defs', 'lib/tern/defs/');
shell.cp('-R', 'src/tern/plugin', 'lib/tern/plugin/');
// Copy Html Language Service files
// shell.cp('-R', 'src/html-language-service/beautify/*.js', 'lib/html-language-service/beautify/');
// shell.mkdir('-p', 'lib/html-language-service/beautify/esm/');
// shell.cp('-R', 'src/html-language-service/beautify/esm/*.js', 'lib/html-language-service/beautify/esm/');
