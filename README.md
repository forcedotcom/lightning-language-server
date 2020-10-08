just a test
[![CircleCI](https://circleci.com/gh/forcedotcom/lightning-language-server/tree/master.svg?style=svg)](https://circleci.com/gh/forcedotcom/lightning-language-server/tree/master)
[![codecov](https://codecov.io/gh/forcedotcom/lightning-language-server/branch/master/graph/badge.svg)](https://codecov.io/gh/forcedotcom/lightning-language-server)
[![License](https://img.shields.io/badge/License-BSD%203--Clause-blue.svg)](https://opensource.org/licenses/BSD-3-Clause)<br/>
[![npm (scoped)](https://img.shields.io/npm/v/@salesforce/lwc-language-server?label=lwc-language-server&logo=npm)](https://www.npmjs.com/package/@salesforce/lwc-language-server)
[![npm (scoped)](https://img.shields.io/npm/v/@salesforce/aura-language-server?label=aura-language-server&logo=npm)](https://www.npmjs.com/package/@salesforce/aura-language-server)
[![npm (scoped)](https://img.shields.io/npm/v/@salesforce/lightning-lsp-common?label=lightning-lsp-common&logo=npm)](https://www.npmjs.com/package/@salesforce/lightning-lsp-common)
[![Commitizen friendly](https://img.shields.io/badge/commitizen-friendly-brightgreen.svg)](http://commitizen.github.io/cz-cli/)

# Lightning Language Servers

Mono repo for the LWC and Aura Language Services that are used in the [Salesforce Extensions for VS Code](https://github.com/forcedotcom/salesforcedx-vscode).

### Issues & Features

Open issues and feature requests on the [Salesforce VSCode Extensions Repository](https://github.com/forcedotcom/salesforcedx-vscode/issues/new/choose).

## Setup Development Environment

### Pre-requisites

Follow the pre-requisites here:
https://github.com/forcedotcom/salesforcedx-vscode/blob/develop/CONTRIBUTING.md

### Clone this repository and Salesforce VSCode Extensions

```
git clone git@github.com:forcedotcom/lightning-language-server.git
git clone git@github.com:forcedotcom/salesforcedx-vscode.git
```

Note: These projects need to be cloned into the same parent directory

### Setup lightning-language-server repository

```
cd lightning-language-server
yarn install
yarn link-lsp
```

### Setup Salesforce VSCode Extensions repository

```
cd ../salesforcedx-vscode
npm install
npm run link-lsp
npm run compile
```

### Open both repositories in a vscode workspace

```
code ./vscode-workspaces/multiroot-simple.code-workspace
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

## Publishing

### Automated publish to NPM
Automated deploys to NPM will occur weekly on Sundays @midnight via CircleCI.
https://circleci.com/gh/forcedotcom/lightning-language-server/tree/master 

### On-Demand publish to NPM
If you want to have CircleCI publish the current master branch to NPM, you can run the following script to trigger the deploy job to run:

```
curl -v -u ${CircleCIToken}: -X POST --header "Content-Type: application/json" -d '{
  "branch": "master",
  "parameters": {
    "deploy": true,
    "version": "patch"
  }
}' https://circleci.com/api/v2/project/gh/forcedotcom/lightning-language-server/pipeline
```

You can also modify the version parameter in the curl script to configure how the version is bumped. Valid values are: [major | minor | patch | premajor | preminor | prepatch | prerelease]. By default the weekly builds only bump the patch version.

Note: You need to substitute in your own ${CircleCIToken} to make this script work. You can create a Personal API Token by following the instructions here:
https://circleci.com/docs/2.0/managing-api-tokens/#creating-a-personal-api-token

### Manual publish to NPM (from your local machine)
```
yarn bump-versions
yarn publish-lsp
```

Note: you will have to be authenticated to an account that has access to the @salesforce org on NPM