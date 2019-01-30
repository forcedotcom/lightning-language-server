const fs = require('fs');
const tags = JSON.parse(fs.readFileSync('aura-system.json.bak','utf-8'));

const tagkeys = Object.keys(tags);
for (const key of tagkeys) {
    const tag = tags[key];
    tag.namespace = 'aura';
    const a = [];
    for(const attr of Object.keys(tag.attributes)) {
        const new_attribute = {
            ...tag.attributes[attr]
        }
        new_attribute.name = attr;
        a.push(new_attribute);
        if (new_attribute.required) {
            new_attribute.required = 'true';
        } else {
            new_attribute.required = 'false';
        }
        new_attribute.access = 'global';
    }
    tag.attributes = a;
}
const out = JSON.stringify(tags, null, 3);
fs.writeFileSync('aura-system.json',out, 'utf-8');
debugger;