import {
    TextDocument,
    Position,
    CompletionItem,
    CompletionItemKind,
} from 'vscode-languageserver';

class RaptorCompletionItem implements CompletionItem {
    constructor(readonly label: string, readonly kind: CompletionItemKind) {}
}

const RAPTOR_COMPLETION_ITEMS: CompletionItem[] = [
    new RaptorCompletionItem('for:each', CompletionItemKind.Function),
    new RaptorCompletionItem('if:true', CompletionItemKind.Function),
    new RaptorCompletionItem('if:false', CompletionItemKind.Function),
];

export default function doCompilation(
    document: TextDocument,
    position: Position,
): CompletionItem[] {
    return isPostionInTag(document, position) ? RAPTOR_COMPLETION_ITEMS : [];
}

function isPostionInTag(document: TextDocument, position: Position): boolean {
    const source = document.getText();
    let offset = document.offsetAt(position);

    if (source.charAt(offset) === '>') {
        // handle case where the cursor is at the closing bracket location in the tag
        return true;
    } else {
        // walk backward the source to see if it's present in a tag
        while (offset > 0) {
            if (source.charAt(offset) === '<') {
                return true;
            } else if (source.charAt(offset) === '>') {
                return false;
            }
            offset--;
        }
    }

    return false;
}
