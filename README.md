# lightning-language-server
Mono repo for lwc-language-server and aura-language-server

Running

Create a common directory for LSP

```mkdir ~/git/LSP```

Clone vscode fork

```git clone git@github.com:midzelis/salesforcedx-vscode.git```

Clone this monorepo

```git clone git@git.soma.salesforce.com:lightning-tools/lightning-language-server.git```

```cd lightning-language-server```

```yarn install```

Link the packages

```yarn lerna exec yarn link```

Go to vscode

```cd ../salesforcedx-vscode```

The other side of link

```./link-lsp.sh```

Install/build vscode

```npm install```

