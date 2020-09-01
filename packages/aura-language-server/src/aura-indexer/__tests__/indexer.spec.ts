import { WorkspaceContext } from '@salesforce/lightning-lsp-common';
import AuraIndexer from '../indexer';
import * as path from 'path';
import URI from 'vscode-uri';

function normalize(start: string, p: string) {
    // Fix relative paths on windows
    if (start.indexOf('\\') !== -1) {
        start = start.replace(/\\/g, '/');
    }
    if (p.indexOf('\\') !== -1) {
        p = p.replace(/\\/g, '/');
    }

    // Need toLowerCase on windows due to paths differing in case (C:/ and c:/)
    if (p.toLowerCase().startsWith(start.toLowerCase())) {
        return p.slice(start.length + 1);
    }
    return p;
}
function uriToFile(uri: string): string {
    return URI.parse(uri).fsPath;
}

it('aura indexer', async () => {
    const ws = 'test-workspaces/sfdx-workspace';
    const full = path.resolve(ws);

    const context = new WorkspaceContext(ws);
    await context.configureProject();
    const auraIndexer = new AuraIndexer(context);
    await auraIndexer.configureAndIndex();
    context.addIndexingProvider({ name: 'aura', indexer: auraIndexer });

    let markup = await context.findAllAuraMarkup();
    markup = markup.map(p => normalize(full, p));
    markup = markup.sort();
    expect(markup).toMatchSnapshot();

    const tags = auraIndexer.getAuraTags();
    tags.forEach(taginfo => {
        if (taginfo.file) {
            taginfo.file = normalize(full, taginfo.file);
        }
        if (taginfo.location && taginfo.location.uri) {
            taginfo.location.uri = normalize(full, uriToFile(taginfo.location.uri));
        }
        if (taginfo.attributes) {
            taginfo.attributes = taginfo.attributes.sort((a, b) => a.name.localeCompare(b.name));
            for (const attribute of taginfo.attributes) {
                if (attribute.location && attribute.location.uri) {
                    attribute.location.uri = normalize(full, uriToFile(attribute.location.uri));
                }
            }
        }
    });
    const sortedTags = new Map([...tags.entries()].sort());
    expect(sortedTags).toMatchSnapshot();

    const namespaces = auraIndexer.getAuraNamespaces().sort();
    expect(namespaces).toMatchSnapshot();
});
