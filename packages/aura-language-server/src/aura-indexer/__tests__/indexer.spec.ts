import { utils, WorkspaceContext } from 'lightning-lsp-common';
import AuraIndexer from '../indexer';

it('indexer', async () => {
    const context = new WorkspaceContext('test-workspaces/sfdx-workspace');
    await context.configureProject();
    const auraIndexer = new AuraIndexer(context);
    await auraIndexer.configureAndIndex();
    context.addIndexingProvider({ name: 'aura', indexer: auraIndexer });

    await context.findAllAuraMarkup();
    // verify jsconfig.json after indexing
});
