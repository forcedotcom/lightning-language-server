## Contributing

1. Familiarize yourself with the codebase by reading the [docs](https://github.com/forcedotcom/salesforcedx-vscode/blob/develop/docs/), in
   particular the [development](https://github.com/forcedotcom/salesforcedx-vscode/blob/develop/docs/developing.md) doc.
1. Create a new issue before starting your project so that we can keep track of
   what you are trying to add/fix. That way, we can also offer suggestions or
   let you know if there is already an effort in progress.
1. Fork this repository.
1. The [README](README.md) has details on how to set up your environment.
1. Create a _topic_ branch in your fork based on the correct branch (usually the **main** branch, see [Branches section](#branches) below). Note, this step is recommended but technically not required if contributing using a fork.
1. Edit the code in your fork.
1. Sign CLA (see [CLA](#cla) below)
1. Send us a pull request when you are done. We'll review your code, suggest any
   needed changes, and merge it in.

### Committing

1. We enforce commit message format. We recommend using [commitizen](https://github.com/commitizen/cz-cli) by installing it with `npm install -g commitizen` and running `npm run commit-init`. When you commit, we recommend that you use `npm run commit`, which prompts you with a series of questions to format the commit message. Or you can use our VS Code Task `Commit`.
1. The commit message format that we expect is: `type: commit message`. Valid types are: feat, fix, improvement, docs, style, refactor, perf, test, build, ci, chore and revert.
1. Before commit and push, Husky runs several hooks to ensure the commit message is in the correct format and that everything lints and compiles properly.

### CLA

External contributors will be required to sign a Contributor's License
Agreement. You can do so by going to https://cla.salesforce.com/sign-cla.

## Branches

- We work in `main`.
- Our released (aka. _production_) branch is `main`.
- Our work happens in _topic_ branches (feature and/or bug-fix).
  - feature as well as bug-fix branches are based on `main`
  - branches _should_ be kept up-to-date using `rebase`
  - see below for further merge instructions

### Merging between branches

- We try to limit merge commits as much as possible.

  - They are usually only ok when done by our release automation.

- _Topic_ branches are:

  1. based on `main` and will be
  1. squash-merged into `main`.

- Hot-fix branches are an exception.
  - Instead we aim for faster cycles and a generally stable `develop` branch.

## Pull Requests

- Develop features and bug fixes in _topic_ branches.
- _Topic_ branches can live in forks (external contributors) or within this repository (committers).
  \*\* When creating _topic_ branches in this repository please prefix with `<developer-name>/`.

### Merging Pull Requests

- Pull request merging is restricted to squash & merge only.

## Updating serialized definition files

_To eventually be replaced by the mini-shape-api_

Run the ftest in core
ui.lightning.tools.impl.test.func.shape.DefinitionShapeIntegrationTest#testShapeGeneration

This should generate a definition json file that you can replace aura-standard.json with.

To update lwc-standard.json, you'll need to change the test to output a version for modules.

See this repo on updating the shape of lwc-standard.json after generating it from the ftest.
https://git.soma.salesforce.com/kgray/lwc-standard-format
