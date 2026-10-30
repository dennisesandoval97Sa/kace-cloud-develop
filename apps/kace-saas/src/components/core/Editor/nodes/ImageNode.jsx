import { $createNodeSelection, $setSelection, DecoratorNode } from "lexical";
import { TemplateImagePreview } from "./TemplateImagePreview";

const TEMPLATE_ATTACHMENT_SCHEME = "template-attachment://";

// exportDOM() below stashes the template-attachment reference in this data attribute
// instead of `src` (see comment there for why). Callers of $generateHtmlFromNodes must
// run the resulting HTML through restoreTemplateAttachmentSrc() to turn it back into a
// real `src` before using/sanitizing the string.
const TEMPLATE_ATTACHMENT_SRC_PLACEHOLDER_ATTR = "data-template-attachment-src";

export function restoreTemplateAttachmentSrc(html) {
    return html.replaceAll(`${TEMPLATE_ATTACHMENT_SRC_PLACEHOLDER_ATTR}="`, 'src="');
}

function convertImageElement(domNode) {
    if (domNode instanceof HTMLImageElement) {
        const { src, alt, width, height } = domNode;
        if (!src) return null;

        if (src.startsWith(TEMPLATE_ATTACHMENT_SCHEME)) {
            const templateId = src.slice(TEMPLATE_ATTACHMENT_SCHEME.length);
            const filename = domNode.getAttribute("data-filename") || undefined;
            const mime = domNode.getAttribute("data-mime") || undefined;
            const node = $createImageNode({
                templateId,
                filename,
                mime,
                altText: alt,
                width: width || undefined,
                height: height || undefined,
            });
            return { node };
        }

        const filename = domNode.getAttribute("data-filename") || undefined;
        const mime = domNode.getAttribute("data-mime") || undefined;
        const node = $createImageNode({
            src,
            altText: alt,
            width: width || undefined,
            height: height || undefined,
            filename,
            mime,
        });
        return { node };
    }
    return null;
}

export class ImageNode extends DecoratorNode {
    __src;
    __altText;
    __width;
    __height;
    __templateId;
    __filename;
    __mime;

    static getType() {
        return "image";
    }

    static clone(node) {
        return new ImageNode(
            node.__src,
            node.__altText,
            node.__width,
            node.__height,
            node.__templateId,
            node.__filename,
            node.__mime,
            node.__key,
        );
    }

    static importJSON(serializedNode) {
        const { src, altText, width, height, templateId, filename, mime } = serializedNode;
        return $createImageNode({ src, altText, width, height, templateId, filename, mime });
    }

    exportJSON() {
        return {
            type: "image",
            version: 1,
            src: this.__src,
            altText: this.__altText,
            width: this.__width,
            height: this.__height,
            templateId: this.__templateId,
            filename: this.__filename,
            mime: this.__mime,
        };
    }

    static importDOM() {
        return {
            img: () => ({
                conversion: convertImageElement,
                priority: 0,
            }),
        };
    }

    // Images backed by a template attachment always export the stable
    // `template-attachment://<id>` placeholder — never the presigned preview
    // URL currently held in memory — so the reference survives past the
    // preview URL's expiration. See TemplateAttachmentInlineImageEmbedder
    // (backend) for how it's resolved again at send time.
    exportDOM() {
        const element = document.createElement("img");
        if (this.__templateId) {
            // Not a real `src`: setting `src` on an <img> starts the image-download
            // algorithm the instant it's assigned, even while the element is detached
            // from the document. `template-attachment://` isn't a fetchable scheme, so
            // that phantom request trips the CSP img-src directive on every editor
            // update. Stash it in a data attribute instead — restoreTemplateAttachmentSrc()
            // renames it back to `src` in the serialized HTML string.
            element.setAttribute(
                TEMPLATE_ATTACHMENT_SRC_PLACEHOLDER_ATTR,
                `${TEMPLATE_ATTACHMENT_SCHEME}${this.__templateId}`,
            );
            if (this.__filename) element.setAttribute("data-filename", this.__filename);
            if (this.__mime) element.setAttribute("data-mime", this.__mime);
        } else {
            element.setAttribute("src", this.__src);
            /*
             * Filename/mime aren't needed to render a plain src, but a pending (not-yet-
             * uploaded) inline image relies on them to be re-identified and resolved into
             * a real template-attachment:// reference — see resolveInlinePendingImages.
             */
            if (this.__filename) element.setAttribute("data-filename", this.__filename);
            if (this.__mime) element.setAttribute("data-mime", this.__mime);
        }
        if (this.__altText) element.setAttribute("alt", this.__altText);
        if (this.__width) element.setAttribute("width", String(this.__width));
        if (this.__height) element.setAttribute("height", String(this.__height));
        return { element };
    }

    constructor(src, altText = "", width, height, templateId, filename, mime, key) {
        super(key);
        this.__src = src;
        this.__altText = altText;
        this.__width = width;
        this.__height = height;
        this.__templateId = templateId ?? null;
        this.__filename = filename ?? null;
        this.__mime = mime ?? null;
    }

    getSrc() {
        return this.__src;
    }

    createDOM() {
        return document.createElement("span");
    }

    updateDOM() {
        return false;
    }

    decorate(editor) {
        /*
         * Images (both freshly inserted and ones already saved/loaded into an existing
         * template) aren't otherwise selectable: there's no native text caret inside a
         * DecoratorNode's rendered content, so a click on the <img> itself does nothing
         * by default. Explicitly selecting the node on click is what lets the toolbar's
         * delete-image button (see Toolbar's $updateToolbar/handleDeleteImageClick)
         * appear for an image the user is just now looking at, not only one they just
         * inserted in this same session.
         */
        const key = this.getKey();
        const handleClick = (event) => {
            event.preventDefault();
            event.stopPropagation();
            editor.update(() => {
                const nodeSelection = $createNodeSelection();
                nodeSelection.add(key);
                $setSelection(nodeSelection);
            });
        };

        if (this.__templateId) {
            return (
                <TemplateImagePreview
                    templateId={this.__templateId}
                    filename={this.__filename}
                    mime={this.__mime}
                    altText={this.__altText}
                    width={this.__width}
                    height={this.__height}
                    onClick={handleClick}
                />
            );
        }

        // Same cap as TemplateImagePreview: only constrain height when the source
        // HTML didn't already specify one, so explicitly-sized template images keep
        // their author-intended dimensions.
        const style = this.__height ? { maxWidth: "100%" } : { maxWidth: "100%", maxHeight: 200, objectFit: "contain" };

        return (
            <img
                src={this.__src}
                alt={this.__altText}
                width={this.__width}
                height={this.__height}
                style={{ ...style, cursor: "pointer" }}
                onClick={handleClick}
            />
        );
    }
}

export function $createImageNode({ src, altText = "", width, height, templateId, filename, mime, key }) {
    return new ImageNode(src, altText, width, height, templateId, filename, mime, key);
}

export function $isImageNode(node) {
    return node instanceof ImageNode;
}
