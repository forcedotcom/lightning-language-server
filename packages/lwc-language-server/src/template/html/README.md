# HTML Parser & scanner

The code in this folder has been copied and modified from the [vscode-html-languageservice](https://github.com/Microsoft/vscode-html-languageservice/) project.

We use this parser instead of a HTML complient parser like [parse5](https://github.com/inikulin/parse5), because for autocomplitation purposes the parsed needs to be able to understand code that is not well-formatted.