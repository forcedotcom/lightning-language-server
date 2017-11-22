import * as fs from 'fs-extra';
import { join } from 'path';
import { isSfdxProject, getSfdxResource } from '../utils';

/**
 * Configures a sfdx project
 */
export function configSfdxProject(workspaceRoot: string) {
    if (!isSfdxProject(workspaceRoot)) {
        return;
    }

    // copies relevant files from the extension src/resources/sfdx folder to the sfdx project

    // copy jsconfig.json
    // TODO: allow user modifications in jsonfig.json
    fs.copySync(getSfdxResource('jsconfig-sfdx.json'), join(workspaceRoot, 'jsconfig.json'));

    // copy engine.d.ts, lwc.d.ts to ./typings
    const typingsDir = join(workspaceRoot, 'typings');
    fs.ensureDir(typingsDir);
    fs.copySync(getSfdxResource(join('typings', 'engine.d.ts')), join(typingsDir, 'engine.d.ts'));
    fs.copySync(getSfdxResource(join('typings', 'lwc.d.ts')), join(typingsDir, 'lwc.d.ts'));
}
