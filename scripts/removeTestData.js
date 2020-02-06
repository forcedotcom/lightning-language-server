#!/usr/bin/env node
const rimraf = require('rimraf');

const pathsToRemove = [
  // Remove the .vscode dirs
  'test-workspaces/sfdx-workspace/.vscode/',
  'test-workspaces/core-like-workspace/.vscode/',
  'test-workspaces/core-like-workspace/app/main/core/.vscode/',
  'test-workspaces/core-like-workspace/app/main/core/ui-force-components/.vscode/',
  'test-workspaces/core-like-workspace/app/main/core/ui-global-components/.vscode/',
  'test-workspaces/standard-workspace/.vscode/',
 
  // Remove the .sfdx dirs
  'test-workspaces/sfdx-workspace/.sfdx/',
  'test-workspaces/standard-workspace/.sfdx/',

  // Remove the jsconfig.json
  'test-workspaces/sfdx-workspace/force-app/main/default/lwc/jsconfig.json',
  'test-workspaces/core-like-workspace/app/main/core/jsconfig.json',
  'test-workspaces/core-like-workspace/app/main/core/ui-force-components/modules/jsconfig.json',
  'test-workspaces/core-like-workspace/app/main/core/ui-global-components/modules/jsconfig.json',
  'test-workspaces/standard-workspace/jsconfig.json',
  'test-workspaces/standard-workspace/src/modules/jsconfig.json'
];

for (let i = 0; i < pathsToRemove.length; i++) {
  const element = pathsToRemove[i];
  rimraf.sync(element);
  console.log('Removed: ' + element);
}


