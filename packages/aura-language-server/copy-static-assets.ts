import * as shell from "shelljs";

shell.cp("-R", "src/tern-server/*.json", "lib/tern-server/");
shell.cp("-R", "src/markup/*.json", "lib/markup/");
// Copy Html Language Service files
shell.cp("-R", "src/html-language-service/beautify/*.js", "lib/html-language-service/beautify/");
shell.mkdir("-p", "lib/html-language-service/beautify/esm/");
shell.cp("-R", "src/html-language-service/beautify/esm/*.js", "lib/html-language-service/beautify/esm/");