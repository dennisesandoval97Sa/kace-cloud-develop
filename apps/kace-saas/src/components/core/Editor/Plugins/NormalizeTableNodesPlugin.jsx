import { useEffect } from "react";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { mergeRegister } from "@lexical/utils";
import { TableNode, TableCellNode } from "@lexical/table";
import { KaceTableNode, $isKaceTableNode } from "../nodes/KaceTableNode";
import { KaceTableCellNode, $isKaceTableCellNode } from "../nodes/KaceTableCellNode";

/*
 * KaceTableNode/KaceTableCellNode are registered as the canonical "table"/"tablecell"
 * node classes (see Editor.jsx) so their importDOM conversions win when parsing real
 * HTML (paste, initial load) — that's what captures a table's original style/border.
 * But @lexical/table's own commands (INSERT_TABLE_COMMAND from the toolbar's "insert
 * table" button, and its Tab-to-add-row behavior) construct plain base TableNode/
 * TableCellNode instances directly, bypassing that. This transform swaps any such
 * base-class instance for an equivalent Kace one as soon as it's marked dirty, so
 * KaceTableNode/KaceTableCellNode's exportDOM (which strips the editor-only theme
 * class and, for cells with no captured original style, the 1px border) always
 * applies — regardless of how the table was created.
 */
export const NormalizeTableNodesPlugin = () => {
    const [editor] = useLexicalComposerContext();

    useEffect(() => {
        return mergeRegister(
            editor.registerNodeTransform(TableNode, (node) => {
                if ($isKaceTableNode(node)) return;
                node.replace(new KaceTableNode(), true);
            }),
            editor.registerNodeTransform(TableCellNode, (node) => {
                if ($isKaceTableCellNode(node)) return;
                const replacement = new KaceTableCellNode(node.__headerState, node.__colSpan, node.__width);
                replacement.__rowSpan = node.__rowSpan;
                replacement.__backgroundColor = node.__backgroundColor;
                node.replace(replacement, true);
            }),
        );
    }, [editor]);

    return null;
};
