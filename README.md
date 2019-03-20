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

```
git clone git@git.soma.salesforce.com:lightning-tools/lightning-language-server.git
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

### Open VSCode Workspace
```
code ./vscode-workspaces/lsp-all.code-workspace
```

### Launch VSCode Debug
Run 'Launch DX - Aura & LWC' from VSCode

### Debugging Language Server when it doesn't startup
TODO
