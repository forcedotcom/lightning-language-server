# Requirements

* Node 8+
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

To run/debug this language server in VSCode you can launch it from the [salesforcedx-vscode](https://github.com/midzelis/salesforcedx-vscode) client extension (Note: this is currently points to Min's fork until we merge our stuff into the DX extension)

First setup salesforcedx-vscode to use the live aura-language-server source:
```sh
cd ~/git/aura-language-server; npm link
cd ~/git/salesforcedx-vscode; npm link aura-language-server
npm install
cd ./packages/salesforcedx-vscode-aura; npm link aura-language-server
```

# Run/debug both projects in VSCode:
1. Launch the salesforcedx-vscode extension using the "Launch Extensions" debug configuration in salesforcedx-vscode.
2. Attach the debugger to the aura-language-server using the "Attach to LS" debug configuration in aura-language-server.
3. Be sure your test environment for vscode is pointing to a DX repository like [ebikes](https://github.com/trailheadapps/ebikes-lwc) - otherwise the plugin will not be activated
4. You should be able to set a breakpoint in the server.ts 'onCompletion' method and see it get hit when invoking content assist from within a .cmp file

# Rebuilding after changes
1. Stop salesforcedx-vscode
2. Rebuild aura-language-server (CMD+SHIFT+B)
3. Relaunch salesforcedx-vscode
4. Re-attach aura-language-server debugger