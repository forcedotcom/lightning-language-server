[![CircleCI](https://circleci.com/gh/forcedotcom/lightning-language-server/tree/master.svg?style=svg)](https://circleci.com/gh/forcedotcom/lightning-language-server/tree/master)
[![codecov](https://codecov.io/gh/forcedotcom/lightning-language-server/branch/master/graph/badge.svg)](https://codecov.io/gh/forcedotcom/lightning-language-server)
[![License](https://img.shields.io/badge/License-BSD%203--Clause-blue.svg)](https://opensource.org/licenses/BSD-3-Clause)
![npm (scoped)](https://img.shields.io/npm/v/lwc-language-server?registry_uri=https%3A%2F%2Fregistry.npmjs.org%2F)

# Lightning Language Servers

Mono repo for the LWC and Aura Language Services that are used in the [Salesforce Extensions for VS Code](https://github.com/forcedotcom/salesforcedx-vscode).

## Issues & Features

Open issues and feature requests on the [SalesforceDX-VSCode Repository](https://github.com/forcedotcom/salesforcedx-vscode/issues/new/choose).

## Setup

### Pre-requisites

Follow the pre-requisites here:
https://github.com/forcedotcom/salesforcedx-vscode/blob/develop/docs/developing.md

### Create a common directory for LSP

```
mkdir ~/git/LSP
cd ~/git/LSP
```

### Clone this repo and DX Plugins

```
git clone git@github.com:forcedotcom/lightning-language-server.git
git clone git@github.com:forcedotcom/salesforcedx-vscode.git
```

### Setup lightning-language-server

```
cd lightning-language-server
yarn install
yarn link-lsp
```

### Setup the DX Plugins

```
cd ../salesforcedx-vscode
npm install
npm run link-lsp
npm run compile
```

### Recompile LSP on changes

```
cd ../lightning-language-server
yarn watch
```

### Testing

Runs all our tests across every package

```
yarn test
```

### Publishing

Login to the lwcjs npm registry using the 'lwcadmin' credentials. Note: package versions will be updated as part of the lerna publish command, so you don't need to update them yourself.

```
npm login --registry https://registry.npmjs.org
lerna publish --exact
```

### Open VSCode Workspace

This workspace has top level folders for lightning-lsp-common / aura-language-server / lwc-language-server / DX so you can see everything from a single workspace.

```
code ./vscode-workspaces/lsp-all.code-workspace
```

### Launch VSCode Debug

Run 'Launch DX - Aura & LWC' from the VSCode debug view (its the last one in that long list). Note: you need to restart vscode each time you make language server changes (even though the file watcher is compiling them on the fly). Easiest way to do this is to kill the vscode client and hit F5 to relaunch your debugger.
