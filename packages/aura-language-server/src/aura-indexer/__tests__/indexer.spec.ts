import { utils, WorkspaceContext } from 'lightning-lsp-common';
import { FORCE_APP_ROOT, UTILS_ROOT } from './test-utils';
import AuraIndexer from '../indexer';

it('indexer', async () => {
    const context = new WorkspaceContext('test-workspaces/sfdx-workspace');
    context.configureProject();
    const auraIndexer = new AuraIndexer(context);
    await auraIndexer.configureAndIndex();
    context.addIndexingProvider({ name: 'aura', indexer: auraIndexer });


    context.findAllAuraMarkup();
    // verify jsconfig.json after indexing

});
