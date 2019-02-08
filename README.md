# lightning-language-server
Mono repo for lwc-language-server and aura-language-server

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
(TODO update doc to point at non-fork version of DX when we merge back)

```
git clone git@git.soma.salesforce.com:lightning-tools/lightning-language-server.git
git clone git@github.com:midzelis/salesforcedx-vscode.git
```

### Setup lightning-language-server

```
cd lightning-language-server
yarn install
yarn link-lsp
```
(Note: if link-lsp fails because it can't find the common plugin just run 'lerna exec yarn link')

### Setup the DX Plugins

```
cd ../salesforcedx-vscode
npm run link-lsp
npm install
npm run compile
```

### Recompile LSP on changes
```
cd ../lightning-language-server
yarn watch
```

### Open VSCode Workspace
```
code ./vscode-workspaces/lsp-all.code-workspace
```

### Launch VSCode Debug
Run 'Launch DX - Aura & LWC' from VSCode
