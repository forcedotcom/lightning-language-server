#!/usr/bin/env node

const ncp = require('ncp');
const path = require('path');
const fs = require('fs');

// Copy vscode to these directories
const extensionDirectories = [
  'test-workspaces/core-like-workspace',
  'test-workspaces/core-like-workspace',
  'test-workspaces/sfdx-workspace',
  'test-workspaces/sfdx-workspace',
  'test-workspaces/standard-workspace',
  'test-workspaces/standard-workspace'
];
