import { utils, WorkspaceContext } from 'lightning-lsp-common';
import AuraIndexer from '../indexer';
import * as path from 'path';
import URI from 'vscode-uri';

function normalize(start: string, p: string) {
    if (p.startsWith(start)) {
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
        }
    });
    const sortedTags = new Map([...tags.entries()].sort());
    expect(sortedTags).toMatchSnapshot();

    const namespaces = auraIndexer.getAuraNamespaces().sort();
    expect(namespaces).toMatchSnapshot();
});
