/*
 * Copyright (c) 2022, salesforce.com, inc.
 * All rights reserved.
 * Licensed under the BSD 3-Clause license.
 * For full license text, see LICENSE.txt file in the repo root or https://opensource.org/licenses/BSD-3-Clause
 */

const shell = require("shelljs");

export function preCommit(props) {
  if (props && props.version) {
    shell.exec(`yarn`);
    shell.exec(`yarn bump-versions ${props.version}`);
    shell.exec(`git add .`);
    shell.exec(
      `git commit --allow-empty -m "chore: updated version ${props.version} [ci skip]"`
    );
  }
}
