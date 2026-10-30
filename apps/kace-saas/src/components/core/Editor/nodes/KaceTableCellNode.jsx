import { TableCellNode, TableCellHeaderStates } from "@lexical/table";
import { $applyNodeReplacement, $isElementNode, $isLineBreakNode, $createParagraphNode } from "lexical";

const PIXEL_VALUE_REG_EXP = /^(\d+(?:\.\d+)?)px$/;

function convertKaceTableCellElement(domNode) {
    const nodeName = domNode.nodeName.toLowerCase();
    let width;
    if (PIXEL_VALUE_REG_EXP.test(domNode.style.width)) {
        width = parseFloat(domNode.style.width);
    }

    const cellNode = $createKaceTableCellNode({
        headerState: nodeName === "th" ? TableCellHeaderStates.ROW : TableCellHeaderStates.NO_STATUS,
        colSpan: domNode.colSpan,
        width,
        originalStyle: domNode.getAttribute("style"),
    });
    cellNode.__rowSpan = domNode.rowSpan;
    const backgroundColor = domNode.style.backgroundColor;
    if (backgroundColor !== "") {
        cellNode.__backgroundColor = backgroundColor;
    }

    return {
        // Mirrors @lexical/table's own convertTableCellNodeElement: inline
        // children (e.g. a bare <img>) must be wrapped in a paragraph, since
        // a table cell can't hold a non-element node directly.
        forChild: (lexicalNode, parentLexicalNode) => {
            if ($isKaceTableCellNode(parentLexicalNode) && !$isElementNode(lexicalNode)) {
                if ($isLineBreakNode(lexicalNode) && lexicalNode.getTextContent() === "\n") {
                    return null;
                }
                const paragraphNode = $createParagraphNode();
                paragraphNode.append(lexicalNode);
                return paragraphNode;
            }
            return lexicalNode;
        },
        node: cellNode,
    };
}

export class KaceTableCellNode extends TableCellNode {
    __originalStyle;

    static getType() {
        return "tablecell";
    }

    static clone(node) {
        const cellNode = new KaceTableCellNode(node.__headerState, node.__colSpan, node.__width, node.__key);
        cellNode.__rowSpan = node.__rowSpan;
        cellNode.__backgroundColor = node.__backgroundColor;
        cellNode.__originalStyle = node.__originalStyle;
        return cellNode;
    }

    static importDOM() {
        return {
            td: () => ({ conversion: convertKaceTableCellElement, priority: 1 }),
            th: () => ({ conversion: convertKaceTableCellElement, priority: 1 }),
        };
    }

    static importJSON(serializedNode) {
        const cellNode = $createKaceTableCellNode({
            headerState: serializedNode.headerState,
            colSpan: serializedNode.colSpan || 1,
            width: serializedNode.width || undefined,
            originalStyle: serializedNode.originalStyle || null,
        });
        cellNode.__rowSpan = serializedNode.rowSpan || 1;
        cellNode.__backgroundColor = serializedNode.backgroundColor || null;
        return cellNode;
    }

    exportJSON() {
        return {
            ...super.exportJSON(),
            type: "tablecell",
            originalStyle: this.__originalStyle,
        };
    }

    constructor(headerState, colSpan, width, key) {
        super(headerState, colSpan, width, key);
        this.__originalStyle = null;
    }

    /*
     * Cells parsed from real HTML keep their original inline style verbatim
     * (including having NO style at all, e.g. when the source table sizes
     * columns via <colgroup><col style="width:X%">) instead of Lexical's
     * computed width/alignment defaults, which would otherwise win over the
     * colgroup's column width when rendered.
     */
    exportDOM(editor) {
        const result = super.exportDOM(editor);
        if (result.element) {
            /*
             * The theme class (config.theme.tableCell) is an editor-only display
             * hook applied by createDOM — it must never leak into saved HTML.
             */
            result.element.removeAttribute("class");
            if (this.__originalStyle) {
                result.element.setAttribute("style", this.__originalStyle);
            } else {
                /*
                 * No captured original style: either a brand-new cell (e.g. from the
                 * "insert table" toolbar button) or one parsed from a source <td>
                 * with no style attribute at all. Either way, keep @lexical/table's
                 * computed layout (width/vertical-align/text-align) but drop the 1px
                 * border it always bakes in — that border only makes cell boundaries
                 * visible while editing (see the `kace-editor-table-cell` theme
                 * class), it must not leak into the saved/e-mailed HTML.
                 */
                result.element.style.removeProperty("border");
            }
        }
        return result;
    }
}

export function $createKaceTableCellNode({ headerState, colSpan = 1, width, originalStyle = null } = {}) {
    const node = $applyNodeReplacement(new KaceTableCellNode(headerState, colSpan, width));
    node.__originalStyle = originalStyle;
    return node;
}

export function $isKaceTableCellNode(node) {
    return node instanceof KaceTableCellNode;
}
