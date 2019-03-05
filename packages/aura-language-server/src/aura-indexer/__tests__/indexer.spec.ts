import { utils, WorkspaceContext } from 'lightning-lsp-common';
import AuraIndexer from '../indexer';

it('aura indexer', async () => {
    const context = new WorkspaceContext('test-workspaces/sfdx-workspace');
    await context.configureProject();
    const auraIndexer = new AuraIndexer(context);
    await auraIndexer.configureAndIndex();
    context.addIndexingProvider({ name: 'aura', indexer: auraIndexer });

    const markup = await context.findAllAuraMarkup();
    expect(markup).toMatchSnapshot();

    const tags = auraIndexer.getAuraTags();
    expect(tags).toMatchSnapshot();

    const namespaces = auraIndexer.getAuraNamespaces();
    expect(namespaces).toMatchSnapshot();
});
