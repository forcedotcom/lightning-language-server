import * as glob from 'glob';
import * as path from 'path';

export default class Index {
    readonly workspaceRoot: string;
    readonly sfdxPackageDirsPattern: string;

    constructor(attributes: any) {
        this.workspaceRoot = path.resolve(attributes.workspaceRoot);
        this.sfdxPackageDirsPattern = attributes.sfdxPackageDirsPattern;
    }

    metaFilePaths() {
        const metaFileGlob = `${this.sfdxPackageDirsPattern}/**/+(staticresources|contentassets|messageChannels)/*.+(resource|asset|messageChannel)-meta.xml`;
        return glob.sync(metaFileGlob, { cwd: this.workspaceRoot });
    }
}
