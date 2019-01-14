import * as shell from "shelljs";

shell.cp("-R", "src/tern-server/*.json", "lib/tern-server/");
shell.mkdir("-p", "lib/resources/");
shell.cp("-R", "src/resources/*.json", "lib/resources/");
// Copy Html Language Service files
shell.cp("-R", "src/html-language-service/beautify/*.js", "lib/html-language-service/beautify/");
shell.mkdir("-p", "lib/html-language-service/beautify/esm/");
shell.cp("-R", "src/html-language-service/beautify/esm/*.js", "lib/html-language-service/beautify/esm/");