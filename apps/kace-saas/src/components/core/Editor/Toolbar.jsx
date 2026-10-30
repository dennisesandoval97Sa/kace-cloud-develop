import { useCallback, useEffect, useRef, useState } from "react";
import {
    $getSelection,
    $setSelection,
    $isRangeSelection,
    $isNodeSelection,
    $isTextNode,
    $createNodeSelection,
    $createTextNode,
    $getNodeByKey,
    $getRoot,
    $isElementNode,
    $createParagraphNode,
    $insertNodes,
    BLUR_COMMAND,
    CAN_REDO_COMMAND,
    CAN_UNDO_COMMAND,
    SELECTION_CHANGE_COMMAND,
    PASTE_COMMAND,
    COMMAND_PRIORITY_HIGH,
} from "lexical";
import { useLexicalComposerContext } from "@lexical/react/LexicalComposerContext";
import { mergeRegister, $findMatchingParent, $insertNodeToNearestRoot } from "@lexical/utils";
import { $isTableNode, $createTableRowNode, TableCellHeaderStates } from "@lexical/table";
import { $createKaceTableNode } from "./nodes/KaceTableNode";
import { $createKaceTableCellNode } from "./nodes/KaceTableCellNode";
import { $isHeadingNode } from "@lexical/rich-text";
import { Button } from "@kace/ui-shared";
import { ToggleGroupEditor } from "./ToggleGroupEditor";
import { ToggleGroupAlign } from "./ToggleGroupAlign";
import { ToggleHistoryEditor } from "./ToggleHistoryEditor";
import { BlockTypeSelect } from "./BlockTypeSelect";
import { DropdownMenuModel } from "./Dropdown/DropdownMenuModel";
import { $generateHtmlFromNodes, $generateNodesFromDOM } from "@lexical/html";
import { looksLikeHtml, wrapBareInlineNodes, loadHtmlIntoEditor } from "./utils";
import { registerPendingBlobFile } from "./pendingBlobFileRegistry";
import PropTypes from "prop-types";
import { Code2, ImagePlus, Table as TableIcon, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import DOMPurify from "dompurify";
import { cn } from "@/componentsV2/lib/utils";
import useAttachmentsS3 from "../Attachment/hooks/useAttachmentsS3";
import { $createImageNode, $isImageNode, restoreTemplateAttachmentSrc } from "./nodes/ImageNode";
import {
    TEMPLATE_IMAGE_MAX_BYTES,
    TEMPLATE_IMAGE_ALLOWED_MIME_TYPES,
    TEMPLATE_IMAGE_MAX_DISPLAY_WIDTH,
    TEMPLATE_IMAGE_MAX_DISPLAY_HEIGHT,
} from "./constants";
import { getTranslatedError } from "@/utils/getTranslatedError";
import { TEMPLATE_HTML_SANITIZE_CONFIG } from "@/utils/templateHtmlSanitizeConfig";

const LowPriority = 1;

export const Toolbar = ({
    setValue,
    name = "",
    showFields = false,
    disabled = false,
    onPaste = null,
    onBlur = null,
    imageUpload = null,
    sourceMode = false,
    sourceHtml = "",
    onToggleSource = null,
}) => {
    const [editor] = useLexicalComposerContext();
    const [canUndo, setCanUndo] = useState(false);
    const [canRedo, setCanRedo] = useState(false);
    const [valuesToggle, setValuesToggle] = useState([]);
    const [isInsideTable, setIsInsideTable] = useState(false);
    const [selectedImageKey, setSelectedImageKey] = useState(null);
    const [blockType, setBlockType] = useState("paragraph");
    const [uploadingImage, setUploadingImage] = useState(false);
    const fileInputRef = useRef(null);
    const sanitizeTimeoutRef = useRef(null);
    const suppressNextSourceReexportRef = useRef(false);
    // Read through a ref so an inline onBlur does not re-register the listeners (which drops the pending export).
    const onBlurRef = useRef(onBlur);
    const { getUrlS3File } = useAttachmentsS3();
    const { t } = useTranslation();

    /*
     * Solo NFD + strip de diacr\u00edticos: no aplica toLowerCase ni trim porque el
     * resultado envuelve tokens de plantilla `{{valor}}` que distinguen may\u00fasculas
     * y pueden llevar espacios intencionales.
     * Para b\u00fasquedas insensibles a acentos/may\u00fasculas usar `normalizeForSearch`
     * de "@/utils/textNormalize".
     */
    const removeAccents = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    const handleSelectChange = (value) => {
        const sanitizedValue = removeAccents(value);
        const customValue = `{{${sanitizedValue}}}`;
        if (value) {
            editor.update(() => {
                const selection = $getSelection();
                if ($isRangeSelection(selection)) {
                    selection.insertText(customValue);
                }
            });
        }
    };

    const handleInsertImageClick = () => {
        fileInputRef.current?.click();
    };

    /*
     * Fixed 1x2 layout: covers the common "logo/image in one column, text in the
     * other" template pattern without a rows/columns picker UI. Extra rows/columns
     * can still be added afterward via the table's own row/column controls.
     *
     * Built by hand with $createKaceTableNode/$createKaceTableCellNode instead of
     * dispatching @lexical/table's own INSERT_TABLE_COMMAND: that command's default
     * listener (registered by <TablePlugin/>) constructs plain base TableNode/
     * TableCellNode instances directly, and Lexical's dev build enforces that a
     * node's class matches whatever class is registered for its type — since this
     * editor registers KaceTableNode/KaceTableCellNode under the "table"/"tablecell"
     * types (see Editor.jsx, for their custom importDOM priority), that mismatch
     * throws immediately on construction ("Create node: Type table in node TableNode
     * does not match registered node KaceTableNode..."), before
     * NormalizeTableNodesPlugin's post-hoc swap-transform ever gets a chance to run.
     * Constructing the Kace classes ourselves here avoids that path entirely. Mirrors
     * @lexical/table's own $createTableNodeWithDimensions(1, 2, includeHeaders: false).
     */
    const handleInsertTableClick = () => {
        editor.update(() => {
            const tableNode = $createKaceTableNode();
            const tableRowNode = $createTableRowNode();

            for (let iColumn = 0; iColumn < 2; iColumn++) {
                const tableCellNode = $createKaceTableCellNode({ headerState: TableCellHeaderStates.NO_STATUS });
                const paragraphNode = $createParagraphNode();
                paragraphNode.append($createTextNode());
                tableCellNode.append(paragraphNode);
                tableRowNode.append(tableCellNode);
            }

            tableNode.append(tableRowNode);
            $insertNodeToNearestRoot(tableNode);

            const firstDescendant = tableNode.getFirstDescendant();
            if ($isTextNode(firstDescendant)) {
                firstDescendant.select();
            }
        });
    };

    const GMAIL_INCOMPATIBLE_MIME_TYPES = ["image/webp", "image/gif"];

    const GMAIL_COMPATIBLE_JPEG_QUALITY = 0.85;

    /*
     * Template body images are always sent embedded as a base64 data: URI (see
     * TemplateAttachmentInlineImageEmbedder, capped at 400KB, plus the sent
     * Mail's own 100000-character content field) - there is no separate MIME
     * attachment step. Two compounding problems verified against a real Gmail
     * inbox and real uploads:
     *   1. Gmail strips the `src` attribute entirely from
     *      <img src="data:image/webp..."> and <img src="data:image/gif...">
     *      (leaving alt/width/height but a blank broken-image icon), while the
     *      identical mechanism with image/jpeg renders fine.
     *   2. Re-encoding at the image's native resolution (as this used to do)
     *      can produce a multi-MB file for an ordinary photo - PNG has no
     *      lossy photographic compression, so it can end up *larger* than the
     *      original webp. That blows both the 400KB embed budget (image
     *      silently dropped) and, more severely, the Mail content field's
     *      100000-char cap once base64-inflated (Mail.create throws, and the
     *      whole email silently fails to send - see SendEmail's catch block).
     * Downscaling to the same display cap already applied to width/height
     * (TEMPLATE_IMAGE_MAX_DISPLAY_WIDTH/HEIGHT - there's no point storing more
     * pixels than are ever shown) and re-encoding as JPEG (real photographic
     * compression, unlike PNG) keeps this comfortably within both budgets for
     * ordinary photos. JPEG has no alpha channel, so transparent pixels are
     * flattened onto a white background first. createImageBitmap only decodes
     * the first frame of an animated GIF - acceptable here, since today the
     * whole image is dropped by Gmail regardless.
     */
    const convertToGmailCompatibleFormat = async (file) => {
        if (!GMAIL_INCOMPATIBLE_MIME_TYPES.includes(file.type)) return file;

        const bitmap = await createImageBitmap(file);
        const scale = Math.min(
            1,
            TEMPLATE_IMAGE_MAX_DISPLAY_WIDTH / bitmap.width,
            TEMPLATE_IMAGE_MAX_DISPLAY_HEIGHT / bitmap.height,
        );
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(bitmap.width * scale);
        canvas.height = Math.round(bitmap.height * scale);
        const ctx = canvas.getContext("2d");
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
        bitmap.close?.();

        const jpegBlob = await new Promise((resolve, reject) => {
            canvas.toBlob(
                (result) => (result ? resolve(result) : reject(new Error("upload_error"))),
                "image/jpeg",
                GMAIL_COMPATIBLE_JPEG_QUALITY,
            );
        });

        const jpegName = `${file.name.replace(/\.[^./\\]+$/, "")}.jpg`;
        return new File([jpegBlob], jpegName, { type: "image/jpeg" });
    };

    /*
     * Reads the file's real pixel dimensions and scales them down (never up) to fit within
     * the display cap, preserving aspect ratio. Without this, the <img> ships with no
     * width/height at all, so the sent email (no CSS cap applies there — see
     * TemplateAttachmentInlineImageEmbedder) renders it at full native resolution.
     */
    const getScaledDisplayDimensions = async (file) => {
        try {
            const bitmap = await createImageBitmap(file);
            const { width, height } = bitmap;
            bitmap.close?.();
            const scale = Math.min(
                1,
                TEMPLATE_IMAGE_MAX_DISPLAY_WIDTH / width,
                TEMPLATE_IMAGE_MAX_DISPLAY_HEIGHT / height,
            );
            return { width: Math.round(width * scale), height: Math.round(height * scale) };
        } catch (_error) {
            /*
             * Unsupported format/browser: fall back to no explicit size rather than blocking
             * the upload. The editor preview still gets a CSS cap either way.
             */
            return { width: undefined, height: undefined };
        }
    };

    const handleImageFileSelected = async (event) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file || !imageUpload) return;

        if (!TEMPLATE_IMAGE_ALLOWED_MIME_TYPES.includes(file.type)) {
            toast.error(t("app.alerts.invalid_file_type"));
            return;
        }
        if (file.size > TEMPLATE_IMAGE_MAX_BYTES) {
            toast.error(t("app.alerts.file_too_large", { maxKb: Math.round(TEMPLATE_IMAGE_MAX_BYTES / 1024) }));
            return;
        }

        setUploadingImage(true);
        try {
            const uploadableFile = await convertToGmailCompatibleFormat(file);

            /*
             * Inline images for the same template share one S3 folder (keyed by
             * templateId, not by a per-upload id — see getUrlS3File), so two uploads
             * with the same original filename would silently overwrite each other.
             * Prefixing with a short random id keeps the lookup key (templateId +
             * filename) unique per upload while leaving altText/display name intact.
             */
            const uniqueFilename = `${crypto.randomUUID().slice(0, 8)}-${uploadableFile.name}`;
            const uploadFile = new File([uploadableFile], uniqueFilename, { type: uploadableFile.type });
            const { width, height } = await getScaledDisplayDimensions(uploadableFile);

            let imageNodeProps;
            if (imageUpload.templateId) {
                const [uploaded] = await getUrlS3File(imageUpload.templateId, [uploadFile], imageUpload.keyService);
                await imageUpload.saveAttachment(imageUpload.templateId, [{ ...uploaded, usageType: "inline" }]);
                imageNodeProps = {
                    templateId: imageUpload.templateId,
                    filename: uniqueFilename,
                    mime: uploadableFile.type,
                    altText: file.name,
                    width,
                    height,
                };
            } else {
                /*
                 * The template doesn't exist yet (create flow), so there's no id to key
                 * an S3 upload/attachment record against. Show a local object-URL
                 * preview instead — TemplatesUpdateHandler uploads the file and rewrites
                 * this into a real template-attachment:// reference once the template is
                 * created and its id is known (see resolveInlinePendingImages).
                 */
                const blobUrl = URL.createObjectURL(uploadFile);
                registerPendingBlobFile(blobUrl, uploadFile);
                imageNodeProps = {
                    src: blobUrl,
                    filename: uniqueFilename,
                    mime: uploadableFile.type,
                    altText: file.name,
                    width,
                    height,
                };
            }

            editor.update(() => {
                const imageNode = $createImageNode(imageNodeProps);
                const selection = $getSelection();
                if ($isRangeSelection(selection)) {
                    selection.insertNodes([imageNode]);
                } else {
                    /*
                     * RootNode only accepts ElementNode children — a bare DecoratorNode
                     * can't be appended to it directly, so it needs a paragraph wrapper
                     * when there's no active selection to insert into (e.g. the toolbar
                     * button was clicked without focusing the editor first).
                     */
                    const root = $getRoot();
                    const lastChild = root.getLastChild();
                    if ($isElementNode(lastChild)) {
                        lastChild.append(imageNode);
                    } else {
                        const paragraph = $createParagraphNode();
                        paragraph.append(imageNode);
                        root.append(paragraph);
                    }
                }

                /*
                 * Select the just-inserted image so the delete-image button (see
                 * $updateToolbar/handleDeleteImageClick) is immediately available —
                 * useful right after inserting the wrong file, and avoids relying on
                 * the undiscoverable double-backspace to reach that same selection.
                 */
                const nodeSelection = $createNodeSelection();
                nodeSelection.add(imageNode.getKey());
                $setSelection(nodeSelection);
            });
        } catch (error) {
            /*
             * A real HTTP failure (e.g. the backend rejecting the request) carries
             * `error.response.data` with axios's own generic message ("Request failed
             * with status code 400"), not one of our short i18n codes — those only
             * come from the Errors useAttachmentsS3 throws itself (upload_error,
             * UploadFileErrorSecurity). Same precedence as useAttachmentsActions.js.
             */
            const apiErrorMessage = error?.response?.data ? getTranslatedError(error, t) : undefined;
            toast.error(apiErrorMessage || t(`app.alerts.${error?.message || "upload_error"}`));
        } finally {
            setUploadingImage(false);
        }
    };

    const $updateToolbar = useCallback(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection)) {
            const currentFormats = [];
            if (selection.hasFormat("bold")) currentFormats.push("bold");
            if (selection.hasFormat("italic")) currentFormats.push("italic");
            if (selection.hasFormat("underline")) {
                currentFormats.push("underline");
            }
            if (selection.hasFormat("strikethrough")) {
                currentFormats.push("strikethrough");
            }
            setValuesToggle((previousFormats) =>
                previousFormats.length === currentFormats.length &&
                previousFormats.every((format, index) => format === currentFormats[index])
                    ? previousFormats
                    : currentFormats,
            );
            setIsInsideTable($findMatchingParent(selection.anchor.getNode(), $isTableNode) !== null);
            setSelectedImageKey(null);

            const anchorNode = selection.anchor.getNode();
            const topLevelElement =
                anchorNode.getKey() === "root" ? anchorNode : anchorNode.getTopLevelElementOrThrow();
            setBlockType($isHeadingNode(topLevelElement) ? topLevelElement.getTag() : "paragraph");
        } else if ($isNodeSelection(selection)) {
            /*
             * Backspace/delete next to an inline image only selects it on the first
             * press (a second press is needed to actually delete it, same undiscoverable
             * two-step as tables — see handleDeleteTableClick above). Surfacing a
             * delete-image button here, the same way, skips that second press.
             */
            setIsInsideTable(false);
            const imageNode = selection.getNodes().find($isImageNode);
            setSelectedImageKey(imageNode ? imageNode.getKey() : null);
        } else {
            setIsInsideTable(false);
            setSelectedImageKey(null);
        }
    }, []);

    /*
     * There is no other way to remove a table once inserted: placing the cursor
     * immediately before/after it and pressing backspace/delete only selects it
     * (a second press is needed, which most users never discover), and there is
     * no context menu (no TableCellActionMenuPlugin is wired up). This button
     * removes the table the cursor is currently inside, from any cell.
     */
    const handleDeleteTableClick = () => {
        editor.update(() => {
            const selection = $getSelection();
            if (!$isRangeSelection(selection)) return;
            const tableNode = $findMatchingParent(selection.anchor.getNode(), $isTableNode);
            tableNode?.remove();
        });
    };

    const handleDeleteImageClick = () => {
        editor.update(() => {
            const node = selectedImageKey ? $getNodeByKey(selectedImageKey) : null;
            if (!$isImageNode(node)) return;
            const src = node.getSrc();
            node.remove();
            /*
             * Pending (not-yet-uploaded) inline images preview from a local object URL —
             * free it once the node holding it is gone, same as a normal blob lifecycle.
             */
            if (src?.startsWith("blob:")) URL.revokeObjectURL(src);
        });
        setSelectedImageKey(null);
    };

    /*
     * Entering source mode seeds the textarea from the editor's own current HTML
     * (not the Formik `value` prop, which is only the initial/reset seed and does
     * not track live edits - see RichEditor's `value={initialValues.cuerpo}`).
     * Leaving it ("apply") re-parses the (possibly hand-edited) HTML back into
     * real Lexical nodes via the same sanitize+load path LoadHTML.jsx uses for the
     * initial load, and pushes it to Formik immediately so the change isn't lost
     * if the user saves without switching back to the WYSIWYG view first.
     */
    const handleToggleSourceMode = () => {
        if (!onToggleSource) return;

        if (sourceMode) {
            const sanitized = DOMPurify.sanitize(sourceHtml, TEMPLATE_HTML_SANITIZE_CONFIG);

            /*
             * loadHtmlIntoEditor's own editor.update() marks the tree dirty, which the
             * registerUpdateListener below would otherwise also react to by re-exporting
             * via $generateHtmlFromNodes and calling setValue again - and that re-export
             * is lossy for hand-authored markup (Lexical's HeadingNode/ParagraphNode.
             * exportDOM injects the editor's own Tailwind theme classes, meaningless
             * without the app's stylesheet in the recipient's inbox, and its importer
             * discards any inline style/color the user put on the heading tag itself).
             * Flagging this exact next dirty update lets the listener skip that one
             * re-export deterministically, instead of racing it with a timer (which
             * flaked under load: the debounce could still fire after a fixed delay).
             */
            suppressNextSourceReexportRef.current = true;
            loadHtmlIntoEditor(editor, sanitized);
            setValue(name, sanitized);

            onToggleSource(false);
            return;
        }

        editor.getEditorState().read(() => {
            const htmlString = restoreTemplateAttachmentSrc($generateHtmlFromNodes(editor, null));
            onToggleSource(true, DOMPurify.sanitize(htmlString, TEMPLATE_HTML_SANITIZE_CONFIG));
        });
    };

    useEffect(() => {
        const exportHtml = (editorState) => {
            editorState.read(() => {
                const htmlString = restoreTemplateAttachmentSrc($generateHtmlFromNodes(editor, null));
                setValue(name, DOMPurify.sanitize(htmlString, TEMPLATE_HTML_SANITIZE_CONFIG));
            });
        };

        const unregister = mergeRegister(
            editor.registerUpdateListener(({ editorState, dirtyElements, dirtyLeaves }) => {
                editorState.read(() => {
                    $updateToolbar();
                });

                /*
                 * Selection-only updates (cursor move, SELECTION_CHANGE_COMMAND) leave no
                 * dirty nodes: re-running $generateHtmlFromNodes + DOMPurify.sanitize on
                 * every one of those is wasted work and, on long bodies, visible jank.
                 */
                if (dirtyElements.size === 0 && dirtyLeaves.size === 0) return;

                /*
                 * Always clear any still-pending debounce first, suppressed or not: a
                 * previous dirty update (e.g. the initial LoadHTML mount) may already have
                 * one scheduled, and under heavy load that timer can fire well after this
                 * point - if left pending, it would eventually overwrite handleToggleSourceMode's
                 * synchronous setValue with its own stale, pre-edit closure.
                 */
                clearTimeout(sanitizeTimeoutRef.current);
                sanitizeTimeoutRef.current = null;

                if (suppressNextSourceReexportRef.current) {
                    suppressNextSourceReexportRef.current = false;
                    return;
                }

                sanitizeTimeoutRef.current = setTimeout(() => {
                    sanitizeTimeoutRef.current = null;
                    exportHtml(editorState);
                }, 200);
            }),
            // Leaving the editor (e.g. to click submit) must not wait for the debounce above.
            editor.registerCommand(
                BLUR_COMMAND,
                () => {
                    if (sanitizeTimeoutRef.current !== null) {
                        clearTimeout(sanitizeTimeoutRef.current);
                        sanitizeTimeoutRef.current = null;
                        exportHtml(editor.getEditorState());
                    }
                    onBlurRef.current?.();
                    return false;
                },
                LowPriority,
            ),
            editor.registerCommand(
                SELECTION_CHANGE_COMMAND,
                () => {
                    $updateToolbar();
                    return false;
                },
                LowPriority,
            ),
            editor.registerCommand(
                CAN_UNDO_COMMAND,
                (payload) => {
                    setCanUndo(payload);
                    return false;
                },
                LowPriority,
            ),
            editor.registerCommand(
                CAN_REDO_COMMAND,
                (payload) => {
                    setCanRedo(payload);
                    return false;
                },
                LowPriority,
            ),
            editor.registerCommand(
                PASTE_COMMAND,
                (event) => {
                    /*
                     * Trigger purely on whether the plain-text payload looks like raw HTML
                     * source, regardless of whether a text/html entry is also present.
                     * Sources like chat apps (Slack/Teams/WhatsApp Web) DO write a text/html
                     * entry even for a plain text message someone pasted HTML source into —
                     * it just wraps the literal "<table>..." string in the chat bubble's own
                     * markup (e.g. a <span>), which is accurate: in the chat, that text was
                     * never rendered as a real table. Gating on "no text/html" alone missed
                     * this case entirely, since Lexical's default paste faithfully used that
                     * text/html and kept the tags as literal (later entity-escaped) text.
                     * A genuine rich copy (an actual rendered table/bold text from a page or
                     * email client) never has this problem: browsers derive text/plain from
                     * the rendered content, so it never contains visible "<...>" tag syntax —
                     * looksLikeHtml(plainText) is false for it, and this branch is skipped.
                     */
                    const clipboardData = event?.clipboardData;
                    const plainText = clipboardData?.getData("text/plain") ?? "";
                    const handledAsHtml = looksLikeHtml(plainText);

                    if (handledAsHtml) {
                        event.preventDefault();
                        const sanitized = DOMPurify.sanitize(plainText, TEMPLATE_HTML_SANITIZE_CONFIG);
                        const dom = new DOMParser().parseFromString(sanitized, "text/html");
                        editor.update(() => {
                            const nodes = $generateNodesFromDOM(editor, dom);
                            $insertNodes(wrapBareInlineNodes(nodes));
                        });
                    }

                    setTimeout(() => {
                        editor.getEditorState().read(() => {
                            const htmlString = restoreTemplateAttachmentSrc($generateHtmlFromNodes(editor, null));
                            if (onPaste) {
                                onPaste(name, DOMPurify.sanitize(htmlString, TEMPLATE_HTML_SANITIZE_CONFIG));
                            }
                        });
                    }, 50);
                    return handledAsHtml;
                },
                COMMAND_PRIORITY_HIGH,
            ),
        );
        return () => {
            clearTimeout(sanitizeTimeoutRef.current);
            sanitizeTimeoutRef.current = null;
            unregister();
        };
    }, [editor, $updateToolbar, onPaste]);

    useEffect(() => {
        onBlurRef.current = onBlur;
    });

    return (
        <div
            className="rounded-t-md flex p-2 bg-muted-60 justify-between gap-2 overflow-x-auto"
            id={`toolbar_container_${name}`}
            data-testid={`toolbar_container_${name}`}
        >
            <div
                className={cn("flex gap-2", { "pointer-events-none select-none": disabled })}
                contentEditable={false}
                id={`toolbar_controls_${name}`}
                data-testid={`toolbar_controls_${name}`}
            >
                {!sourceMode && (
                    <>
                        <BlockTypeSelect blockType={blockType} editor={editor} />
                        <span className="w-[1px] bg-gray-600 block h-full"></span>
                        <ToggleGroupEditor valuesToggle={valuesToggle} editor={editor} />
                        <span className="w-[1px] bg-gray-600 block h-full"></span>
                        <ToggleGroupAlign editor={editor} />
                        <span className="w-[1px] bg-gray-600 block h-full"></span>
                        <Button
                            id={`toolbar_insert_table_${name}`}
                            data-testid={`toolbar_insert_table_${name}`}
                            onClick={handleInsertTableClick}
                            aria-label="Insert table"
                            size="icon"
                            type="button"
                            variant="outline"
                        >
                            <TableIcon className="h-4 w-4" />
                        </Button>
                        {isInsideTable && (
                            <Button
                                id={`toolbar_delete_table_${name}`}
                                data-testid={`toolbar_delete_table_${name}`}
                                onClick={handleDeleteTableClick}
                                aria-label="Delete table"
                                size="icon"
                                type="button"
                                variant="outline"
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        )}
                        {imageUpload && (
                            <>
                                <span className="w-[1px] bg-gray-600 block h-full"></span>
                                <input
                                    type="file"
                                    accept={TEMPLATE_IMAGE_ALLOWED_MIME_TYPES.join(",")}
                                    ref={fileInputRef}
                                    className="hidden"
                                    onChange={handleImageFileSelected}
                                    id={`toolbar_insert_image_input_${name}`}
                                    data-testid={`toolbar_insert_image_input_${name}`}
                                />
                                <Button
                                    id={`toolbar_insert_image_${name}`}
                                    data-testid={`toolbar_insert_image_${name}`}
                                    disabled={uploadingImage}
                                    onClick={handleInsertImageClick}
                                    aria-label="Insert image"
                                    title={t("template.form.hints.adjunto_valid_filename")}
                                    size="icon"
                                    type="button"
                                    variant="outline"
                                    className="disabled:cursor-no-drop"
                                >
                                    <ImagePlus className="h-4 w-4" />
                                </Button>
                            </>
                        )}
                        {selectedImageKey && (
                            <Button
                                id={`toolbar_delete_image_${name}`}
                                data-testid={`toolbar_delete_image_${name}`}
                                onClick={handleDeleteImageClick}
                                aria-label="Delete image"
                                size="icon"
                                type="button"
                                variant="outline"
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        )}
                        <span className="w-[1px] bg-gray-600 block h-full"></span>
                        <ToggleHistoryEditor canRedo={canRedo} canUndo={canUndo} editor={editor} />
                        <span className="w-[1px] bg-gray-600 block h-full"></span>
                    </>
                )}
                {onToggleSource && (
                    <Button
                        id={`toolbar_toggle_source_${name}`}
                        data-testid={`toolbar_toggle_source_${name}`}
                        onClick={handleToggleSourceMode}
                        aria-label="View HTML source"
                        aria-pressed={sourceMode}
                        size="icon"
                        type="button"
                        variant={sourceMode ? "default" : "outline"}
                    >
                        <Code2 className="h-4 w-4" />
                    </Button>
                )}
            </div>
            {!sourceMode && showFields && <DropdownMenuModel handleSelectChange={handleSelectChange} />}
        </div>
    );
};

Toolbar.propTypes = {
    setValue: PropTypes.func,
    name: PropTypes.string,
    showFields: PropTypes.bool,
    disabled: PropTypes.bool,
    onPaste: PropTypes.func,
    onBlur: PropTypes.func,
    imageUpload: PropTypes.shape({
        templateId: PropTypes.string,
        keyService: PropTypes.string.isRequired,
        saveAttachment: PropTypes.func.isRequired,
    }),
    sourceMode: PropTypes.bool,
    sourceHtml: PropTypes.string,
    onToggleSource: PropTypes.func,
};
