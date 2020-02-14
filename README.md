![npm (scoped)](https://img.shields.io/npm/v/@salesforce/lwc-language-server?label=lwc-language-server&logo=npm)
![npm (scoped)](https://img.shields.io/npm/v/@salesforce/aura-language-server?label=aura-language-server&logo=npm)
![npm (scoped)](https://img.shields.io/npm/v/@salesforce/lightning-lsp-common?label=lightning-lsp-common&logo=npm)<br/>
[![CircleCI](https://circleci.com/gh/forcedotcom/lightning-language-server/tree/master.svg?style=svg)](https://circleci.com/gh/forcedotcom/lightning-language-server/tree/master)
[![codecov](https://codecov.io/gh/forcedotcom/lightning-language-server/branch/master/graph/badge.svg)](https://codecov.io/gh/forcedotcom/lightning-language-server)
[![License](https://img.shields.io/badge/License-BSD%203--Clause-blue.svg)](https://opensource.org/licenses/BSD-3-Clause)

# Lightning Language Servers

Mono repo for the LWC and Aura Language Services that are used in the [Salesforce Extensions for VS Code](https://github.com/forcedotcom/salesforcedx-vscode).

## Contributing

https://github.com/forcedotcom/lightning-language-server/blob/master/CONTRIBUTING.md


## Issues & Features

Open issues and feature requests on the [SalesforceDX-VSCode Repository](https://github.com/forcedotcom/salesforcedx-vscode/issues/new/choose).

## Setup

### Pre-requisites

Follow the pre-requisites here:
https://github.com/forcedotcom/salesforcedx-vscode/blob/develop/CONTRIBUTING.md

### Create a common directory the language servers and the Salesforce VSCode extensions

```
mkdir ~/git/LSP
cd ~/git/LSP
```

### Clone this repository and Salesforce VSCode Extensions

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

### Setup Salesforce VSCode Extensions

```
cd ../salesforcedx-vscode
npm install
npm run link-lsp
npm run compile
```

### Open both repositories in a vscode workspace

```
code ./vscode-workspaces/multiroot-flat.code-workspace
```

### Debugging with VSCode

Run 'Launch DX - Aura & LWC' from the VSCode debug view (its the last one in that long list). 

### Recompile on change

```
cd ../lightning-language-server
yarn watch
cd ../salesforcedx-vscode
npm run watch
```

Note: You need to restart vscode each time you make changes to the language server or the lightning vscode extensions.
Easiest way to do this is to kill the vscode client and hit F5 to relaunch your debugger.

### Publishing

Every commit to master will get automatically published on NPM.



