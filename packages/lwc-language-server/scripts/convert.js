const fs = require('fs');
const path = require('path');

function getComponentLibraryLink(name) {
    return '[View in Component Library](https://developer.salesforce.com/docs/component-library/bundle/' + name + ')';
}

function getHover(tag, name) {
    let retVal = tag.description + '\n' + getComponentLibraryLink(name) + '\n### Attributes\n';

    for (const info of tag.attributes) {
        retVal += getAttributeMarkdown(info);
        retVal += '\n';
    }

    return retVal;
}

function getAttributeMarkdown(attribute) {
    if (attribute.name && attribute.type && attribute.description) {
        return '* **' + attribute.name + '**: *' + attribute.type + '* ' + attribute.description;
    }

    if (attribute.name && attribute.type) {
        return '* **' + attribute.name + '**: *' + attribute.type + '*';
    }

    if (attribute.name) {
        return '* **' + attribute.name + '**';
    }

    return '';
}

// read old file
const lwcStandard = path.join(__dirname, '..', 'src', 'resources', 'lwc-standard.json');
const f = fs.readFileSync(lwcStandard, { encoding: 'utf-8' });
const data = JSON.parse(f.toString());

// create tags from old file
const tags = Object.keys(data).map(key => {
    const tag = data[key];
    return {
        name: key,
        description: getHover(tag, key),
        attributes: tag.attributes.map(({ name, description }) => ({
            name,
            description,
        })),
    };
});

// make globalAttribute changes here, not in standard-lwc.json as they'll be overwritten
const globalAttributes = [
    {
        name: 'for:each',
        description: 'Renders the element or template block multiple times based on the expression value.',
        references: [
            {
                name: 'Salesforce',
                url: 'https://developer.salesforce.com/docs/component-library/documentation/en/lwc/lwc.reference_directives',
            },
        ],
    },
    {
        name: 'for:item',
        description: 'Bind the current iteration item to an identifier.',
        references: [
            {
                name: 'Salesforce',
                url: 'https://developer.salesforce.com/docs/component-library/documentation/en/lwc/lwc.reference_directives',
            },
        ],
    },
    {
        name: 'for:index',
        description: 'Bind the current iteration index to an identifier.',
        references: [
            {
                name: 'Salesforce',
                url: 'https://developer.salesforce.com/docs/component-library/documentation/en/lwc/lwc.reference_directives',
            },
        ],
    },
    {
        name: 'if:true',
        description: 'Renders the element or template if the expression value is truthy.',
        references: [
            {
                name: 'Salesforce',
                url: 'https://developer.salesforce.com/docs/component-library/documentation/en/lwc/lwc.reference_directives',
            },
        ],
    },
    {
        name: 'if:false',
        description: 'Renders the element or template if the expression value is falsy.',
        references: [
            {
                name: 'Salesforce',
                url: 'https://developer.salesforce.com/docs/component-library/documentation/en/lwc/lwc.reference_directives',
            },
        ],
    },
    {
        name: 'iterator:it',
        description: {
            kind: 'markdown',
            value:
                'Bind the current iteration item to an identifier. Contains properties (`value`, `index`, `first`, `last`) that let you apply special behaviors to certain items.',
        },
        references: [
            {
                name: 'Salesforce',
                url: 'https://developer.salesforce.com/docs/component-library/documentation/en/lwc/lwc.reference_directives',
            },
        ],
    },
];

const newJson = {
    version: '1.1',
    tags,
    globalAttributes,
};

const standardLWC = path.join(__dirname, '..', 'src', 'resources', 'standard-lwc.json');
fs.writeFileSync(standardLWC, JSON.stringify(newJson, null, 2));

console.log('done building standard-lwc.json');
