import { TableNode } from "@lexical/table";
import { $applyNodeReplacement } from "lexical";

function readOriginalColStyles(domNode) {
    const colgroup = domNode.querySelector(":scope > colgroup");
    if (!colgroup) return [];
    return Array.from(colgroup.children).map((col) => col.getAttribute("style"));
}

function convertKaceTableElement(domNode) {
    const node = $createKaceTableNode({
        originalStyle: domNode.getAttribute("style"),
        originalBorder: domNode.getAttribute("border"),
        originalColStyles: readOriginalColStyles(domNode),
    });
    return { node };
}

export class KaceTableNode extends TableNode {
    __originalStyle;
    __originalBorder;
    __originalColStyles;

    static getType() {
        return "table";
    }

    static clone(node) {
        const cloned = new KaceTableNode(node.__key);
        cloned.__originalStyle = node.__originalStyle;
        cloned.__originalBorder = node.__originalBorder;
        cloned.__originalColStyles = node.__originalColStyles;
        return cloned;
    }

    static importDOM() {
        return {
            table: () => ({ conversion: convertKaceTableElement, priority: 1 }),
        };
    }

    static importJSON(serializedNode) {
        return $createKaceTableNode({
            originalStyle: serializedNode.originalStyle || null,
            originalBorder: serializedNode.originalBorder || null,
            originalColStyles: serializedNode.originalColStyles || [],
        });
    }

    exportJSON() {
        return {
            ...super.exportJSON(),
            type: "table",
            originalStyle: this.__originalStyle,
            originalBorder: this.__originalBorder,
            originalColStyles: this.__originalColStyles,
        };
    }

    constructor(key) {
        super(key);
        this.__originalStyle = null;
        this.__originalBorder = null;
        this.__originalColStyles = [];
    }

    // Tables parsed from real HTML keep their original <table style="...">,
    // border attribute, and per-<col> widths from the source <colgroup>
    // instead of Lexical's generated colgroup (which is always empty <col>
    // tags with no width info at all).
    exportDOM(editor) {
        const result = super.exportDOM(editor);
        const baseAfter = result.after;

        return {
            ...result,
            after: (tableElement) => {
                const newElement = baseAfter ? baseAfter(tableElement) : tableElement;
                if (!newElement) return newElement;

                // The theme class (config.theme.table) is an editor-only display
                // hook applied by createDOM — it must never leak into saved HTML.
                newElement.removeAttribute("class");

                if (this.__originalStyle) {
                    newElement.setAttribute("style", this.__originalStyle);
                } else {
                    newElement.removeAttribute("style");
                }

                if (this.__originalBorder !== null && this.__originalBorder !== undefined) {
                    newElement.setAttribute("border", this.__originalBorder);
                }

                const colgroup = newElement.querySelector("colgroup");
                if (colgroup && this.__originalColStyles.length) {
                    Array.from(colgroup.children).forEach((col, i) => {
                        const style = this.__originalColStyles[i];
                        if (style) col.setAttribute("style", style);
                    });
                }

                return newElement;
            },
        };
    }
}

export function $createKaceTableNode({ originalStyle = null, originalBorder = null, originalColStyles = [] } = {}) {
    const node = $applyNodeReplacement(new KaceTableNode());
    node.__originalStyle = originalStyle;
    node.__originalBorder = originalBorder;
    node.__originalColStyles = originalColStyles;
    return node;
}

export function $isKaceTableNode(node) {
    return node instanceof KaceTableNode;
}
