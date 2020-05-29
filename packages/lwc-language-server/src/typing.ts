export default class Typing {
    public static declaration(metaFilename: string): string {
        const regex = /(?<name>[\w-]+)\.(?<metaType>.+)-meta.xml$/;
        const { name, metaType } = regex.exec(metaFilename).groups;

        let modulePath: string;
        switch (metaType) {
            case 'asset':
                modulePath = `@salesforce/contentAssetUrl/${name}`;
                break;
            case 'resource':
                modulePath = `@salesforce/resourceUrl/${name}`;
                break;
            case 'messageChannel':
                modulePath = `@salesforce/messageChannel/${name}__c`;
                break;
            default:
                throw new Error(`meta file ${metaType} not supported`);
        }

        return `declare module "${modulePath}" {
    var ${name}: string;
    export default ${name};
}
`;
    }
}
