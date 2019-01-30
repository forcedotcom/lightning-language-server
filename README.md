# lightning-language-server
Mono repo for lwc-language-server and aura-language-server

## Setup

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

### Setup the DX Plugins

```
cd ../salesforcedx-vscode
./link-lsp.sh
npm install
npm run compile
```

### Recompile LSP on changes
```
cd ../lightning-language-server
yarn watch
```

### Launch VSCode Debug
Run 'Launch DX - Aura & LWC' from VSCode
