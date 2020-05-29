import { parse } from 'path';

export default class Typing {
    public static declaration(metaFilename: string): string {
        const filename: string = metaFilename.substring(0, metaFilename.lastIndexOf('-'));
        const name: string = parse(filename).name;

        return `declare module "@salesforce/contentAssetUrl/${name}" {
    var ${name}: string;
    export default ${name};
}
`;
    }
}
