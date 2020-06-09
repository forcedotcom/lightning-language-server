const fs = require('fs');

function getComponentLibraryLink(name) {
    return '[View in Component Library](https://developer.salesforce.com/docs/component-library/bundle/' + name + ')';
}

function getHover(tag) {
    let retVal = tag.description + '\n' + getComponentLibraryLink(tag.name) + '\n### Attributes\n';

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
const f = fs.readFileSync('lwc-standard.json', { encoding: 'utf-8' });
const data = JSON.parse(f.toString());

// create tags from old file
const tags = Object.keys(data).map(key => {
    const tag = data[key];
    return {
        name: key,
        description: getHover(tag),
        attributes: tag.attributes.map(({ name, description }) => ({
            name,
            description,
        })),
    };
});

const globalAttributes = [
    {
        name: 'for:each',
        decription: 'Renders the element or template block multiple times based on the expression value.',
    },
    {
        name: 'for:item',
        decription: 'Bind the current iteration item to an identifier.',
    },
    {
        name: 'for:index',
        decription: 'Bind the current iteration index to an identifier.',
    },
    {
        name: 'if:true',
        decription: 'Renders the element or template if the expression value is thruthy.',
    },
    {
        name: 'if:false',
        decription: 'Renders the element or template if the expression value is falsy.',
    },
];

const newJson = {
    version: '1.1',
    tags,
    globalAttributes,
};

fs.writeFileSync('standard-lwc.json', JSON.stringify(newJson, null, 2));

console.log('done');
