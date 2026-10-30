import {
    $isTextNode,
    $isElementNode,
    $isDecoratorNode,
    $createParagraphNode,
    $getRoot,
    TextNode,
    ParagraphNode,
} from "lexical";
import { $generateNodesFromDOM } from "@lexical/html";
import DOMPurify from "dompurify";
import { TEMPLATE_HTML_SANITIZE_CONFIG } from "@/utils/templateHtmlSanitizeConfig";

/*
 * Used both to decide how to load an initial `value` (Editor.jsx) and to detect a
 * paste whose clipboard only carried text/plain but whose content is HTML source
 * (e.g. copied via "Copy outerHTML" in devtools) so it can be parsed as markup
 * instead of inserted as literal, later-escaped text (Toolbar.jsx PASTE_COMMAND).
 */
export const looksLikeHtml = (str) => typeof str === "string" && /<\/?[a-z][\s\S]*>/i.test(str);

/*
 * $generateNodesFromDOM returns a flat top-level array that, for a bare inline
 * fragment with no block-level wrapper (e.g. "<b>Hola</b>"), is a raw TextNode
 * instead of a ParagraphNode containing one. $insertNodes can only place
 * element/decorator nodes at the root (RootNode rejects text children), and
 * whether it can merge a bare inline node into a paragraph instead depends on
 * there being an active selection at insert time — not guaranteed (e.g. a
 * command-driven paste). Group any consecutive non-element/non-decorator nodes
 * into a paragraph so the result is always safe to insert regardless of
 * selection state, mirroring how LoadHTML.jsx already treats bare nodes,
 * except wrapping instead of dropping them.
 */
export const wrapBareInlineNodes = (nodes) => {
    const wrapped = [];
    let currentParagraph = null;
    nodes.forEach((node) => {
        if ($isElementNode(node) || $isDecoratorNode(node)) {
            currentParagraph = null;
            wrapped.push(node);
            return;
        }
        if (!currentParagraph) {
            currentParagraph = $createParagraphNode();
            wrapped.push(currentParagraph);
        }
        currentParagraph.append(node);
    });
    return wrapped;
};

/*
 * Shared by LoadHTML.jsx (initial/reset load) and Toolbar.jsx's HTML-source
 * toggle ("apply" step): parses+sanitizes an HTML string and replaces the
 * editor's root content with it. Kept in one place so both entry points sanitize
 * with the exact same DOMPurify config instead of risking future drift between
 * two copies of this security-relevant logic.
 */
export const loadHtmlIntoEditor = (editor, htmlString) => {
    editor.update(() => {
        const sanitizedHtml = DOMPurify.sanitize(htmlString, TEMPLATE_HTML_SANITIZE_CONFIG);
        const parser = new DOMParser();
        const dom = parser.parseFromString(sanitizedHtml, "text/html");
        const paragraphs = dom.querySelectorAll("p");
        paragraphs.forEach((p) => {
            p.removeAttribute("dir");
        });

        const nodes = $generateNodesFromDOM(editor, dom);

        const root = $getRoot();
        root.clear();

        nodes.forEach((node) => {
            if ($isElementNode(node) || $isDecoratorNode(node)) {
                root.append(node);
            }
        });
    });
};

const MIN_ALLOWED_FONT_SIZE = 8;
const MAX_ALLOWED_FONT_SIZE = 72;

const parseAllowedFontSize = (input) => {
    const match = input.match(/^(\d+(?:\.\d+)?)px$/);
    if (match) {
        const n = Number(match[1]);
        if (n >= MIN_ALLOWED_FONT_SIZE && n <= MAX_ALLOWED_FONT_SIZE) {
            return input;
        }
    }
    return "";
};

function parseAllowedColor(input) {
    return /^rgb\(\d+, \d+, \d+\)$/.test(input) ? input : "";
}

const getExtraStyles = (element) => {
    let extraStyles = "";
    const fontSize = parseAllowedFontSize(element.style.fontSize);
    const backgroundColor = parseAllowedColor(element.style.backgroundColor);
    const color = parseAllowedColor(element.style.color);
    if (fontSize !== "" && fontSize !== "15px") {
        extraStyles += `font-size: ${fontSize};`;
    }
    if (backgroundColor !== "" && backgroundColor !== "rgb(255, 255, 255)") {
        extraStyles += `background-color: ${backgroundColor};`;
    }
    if (color !== "" && color !== "rgb(0, 0, 0)") {
        extraStyles += `color: ${color};`;
    }
    return extraStyles;
};

export const constructImportMap = () => {
    const importMap = {};

    for (const [tag, fn] of Object.entries(TextNode.importDOM() || {})) {
        importMap[tag] = (importNode) => {
            const importer = fn(importNode);
            if (!importer) {
                return null;
            }
            return {
                ...importer,
                conversion: (element) => {
                    const output = importer.conversion(element);
                    if (
                        output === null ||
                        output.forChild === undefined ||
                        output.after !== undefined ||
                        output.node !== null
                    ) {
                        return output;
                    }
                    const extraStyles = getExtraStyles(element);
                    if (extraStyles) {
                        const { forChild } = output;
                        return {
                            ...output,
                            forChild: (child, parent) => {
                                const textNode = forChild(child, parent);
                                if ($isTextNode(textNode)) {
                                    textNode.setStyle(textNode.getStyle() + extraStyles);
                                }
                                return textNode;
                            },
                        };
                    }
                    return output;
                },
            };
        };
    }

    return importMap;
};

const removeStylesExportDOM = (editor, target) => {
    const output = target.exportDOM(editor);
    if (output && output.element instanceof HTMLElement) {
        for (const el of [output.element, ...output.element.querySelectorAll('[style],[class],[dir="ltr"]')]) {
            el.removeAttribute("class");
            el.removeAttribute("style");
            if (el.getAttribute("dir") === "ltr") {
                el.removeAttribute("dir");
            }
        }
    }
    return output;
};

export const exportMap = [
    [ParagraphNode, removeStylesExportDOM],
    [TextNode, removeStylesExportDOM],
];
