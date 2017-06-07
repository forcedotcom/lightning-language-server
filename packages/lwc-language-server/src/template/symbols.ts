import { parseFragment, treeAdapters, AST } from 'parse5';
import { TextDocument, SymbolInformation, SymbolKind, Location, Range } from 'vscode-languageserver';

const treeAdapter = treeAdapters.default;

export default function findSymbols(document: TextDocument): SymbolInformation[] {
    const symbols: SymbolInformation[] = [];
    const AST = parseFragment(document.getText(), {
        locationInfo: true,
        treeAdapter,
    });

    findSymbolsRecursively(document, AST, symbols);

    return symbols;
}

function findSymbolsRecursively(document: TextDocument, node: AST.Node, symbols: SymbolInformation[]): void {    
    if (!node || !treeAdapter.isElementNode(node)) {
        return;
    }

    const tagName = treeAdapter.getTagName(node);
    if (tagName && tagName.includes('-')) {
        const parse5Location = (node as AST.Default.Element).__location!;
        const location = Location.create(
            document.uri,
            Range.create(
                document.positionAt(parse5Location.startOffset),
                document.positionAt(parse5Location.endOffset),
            )
        )

        symbols.push({
            name: tagName,
            kind: SymbolKind.Class,
            containerName: '',
            location,
        });
    }

    for (let child of getChildren(node)) {
        findSymbolsRecursively(document, child, symbols);
    }
}

function getChildren(node: AST.ParentNode): AST.Node[] {
    return treeAdapter.getTagName(node) === 'template' ?
        getChildren(treeAdapter.getTemplateContent(node)) :
        treeAdapter.getChildNodes(node);
}