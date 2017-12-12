# Requirements

* Node 6+
* NPM 4+

# Installation

Before doing anything, make sure you have configure `npm` to download packages from Nexus. If it's not the case, follows the steps in this document: https://sfdc.co/npm-nexus.

```sh
npm install                 # Install necessary packages
npm run build               # Compile typescript code to javascript
npm test                    # Run the test
npm test -- --watch         # Run the test in watch mode
```

# Running

To run/debug this language server in VSCode you can launch it from the [lwc-vscode](https://git.soma.salesforce.com/raptor/lwc-vscode) client extension.

First setup lwc-vscode to use the live lwc-language-server source:
```sh
cd ~/git/lwc-language-server; npm link
cd ~/git/lwc-vscode; npm link lwc-language-server
```

and run/debug both projects using VSCode:
1. Launch the lwc-vscode extension using the "Launch Extension" debug configuration in lwc-vscode.
2. Attach the debugger to the lwc-language-server using the "Attach to LS" debug configuration in lwc-language-server.