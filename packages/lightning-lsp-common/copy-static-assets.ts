import * as shell from 'shelljs';

// Copy Html Language Service files
shell.cp('-R', 'src/html-language-service/beautify/*.js', 'lib/html-language-service/beautify/');
shell.mkdir('-p', 'lib/html-language-service/beautify/esm/');
shell.cp('-R', 'src/html-language-service/beautify/esm/*.js', 'lib/html-language-service/beautify/esm/');