export default class Typing {
    public static declaration(metaFilename: string): string {
        const regex = /^(?<name>.+)\.(?<metaType>.+)-meta.xml$/;
        const { name, metaType } = regex.exec(metaFilename).groups;
        const typeMap: { [key: string]: string } = {
            asset: 'contentAssetUrl',
            resource: 'resourceUrl',
        };

        const type: string = typeMap[metaType];

        if (type === undefined) {
            throw new Error(`meta file ${metaType} not supported`);
        }

        return `declare module "@salesforce/${type}/${name}" {
    var ${name}: string;
    export default ${name};
}
`;
    }
}
