import { useState } from "react";
import { LexicalComposer } from "@lexical/react/LexicalComposer";
import { RichTextPlugin } from "@lexical/react/LexicalRichTextPlugin";
import { ContentEditable } from "@lexical/react/LexicalContentEditable";
import { HistoryPlugin } from "@lexical/react/LexicalHistoryPlugin";
import LexicalErrorBoundary from "@lexical/react/LexicalErrorBoundary";
import { TablePlugin } from "@lexical/react/LexicalTablePlugin";
import { TableRowNode } from "@lexical/table";
import { HeadingNode } from "@lexical/rich-text";
import { KaceTableNode } from "./nodes/KaceTableNode";
import { KaceTableCellNode } from "./nodes/KaceTableCellNode";
import { ImageNode } from "./nodes/ImageNode";
import { Toolbar } from "./Toolbar";
import { LoadHTML } from "./Plugins/LoadHTML";
import { NormalizeTableNodesPlugin } from "./Plugins/NormalizeTableNodesPlugin";
import PropTypes from "prop-types";
import ReadOnlyPlugin from "./Plugins/ReadOnlyPlugin";
import { looksLikeHtml } from "./utils";

export const RichEditor = ({
    value = "",
    setValue,
    name = "",
    showFields = false,
    loadingSave = false,
    field = {},
    meta = {},
    readOnly = false,
    onPaste = null,
    onBlur = null,
    imageUpload = null,
    allowHtmlSource = false,
}) => {
    const [sourceMode, setSourceMode] = useState(false);
    const [sourceHtml, setSourceHtml] = useState("");

    const handleToggleSource = (nextMode, html) => {
        if (typeof html === "string") setSourceHtml(html);
        setSourceMode(nextMode);
    };

    const initialConfig = {
        theme: {
            ltr: "ltr",
            rtl: "rtl",
            paragraph: "mb-1",
            text: {
                bold: "font-bold",
                italic: "italic",
                underline: "underline",
                strikethrough: "line-through",
            },
            table: "kace-editor-table",
            tableCell: "kace-editor-table-cell",
            tableCellHeader: "kace-editor-table-cell-header",
            heading: {
                h1: "text-2xl font-bold mb-2",
                h2: "text-xl font-bold mb-2",
                h3: "text-lg font-bold mb-2",
                h4: "text-base font-bold mb-1",
                h5: "text-sm font-bold mb-1",
                h6: "text-xs font-bold mb-1",
            },
        },
        /*
         * Registering the Kace subclasses directly (rather than the {replace, with,
         * withKlass} form) keeps them as the canonical "table"/"tablecell" node
         * classes, which is what makes their importDOM conversions (capturing a
         * pasted/loaded table's original style/border) win when parsing real HTML.
         * @lexical/table's own commands (e.g. INSERT_TABLE_COMMAND, used by the
         * "insert table" toolbar button) still construct plain base TableNode/
         * TableCellNode instances internally though — NormalizeTableNodesPlugin
         * swaps those to the Kace subclass via node transforms so exportDOM
         * (border/class stripping) applies to toolbar-created tables too.
         */
        nodes: [KaceTableNode, KaceTableCellNode, TableRowNode, ImageNode, HeadingNode],
        onError(error) {
            throw error;
        },
    };

    return (
        <div
            className="flex flex-col gap-4 h-full"
            id={`rich_editor_container_${name}`}
            data-testid={`rich_editor_container_${name}`}
        >
            {meta?.touched && meta?.error && (
                <div className="w-full flex justify-end">
                    <label
                        className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 text-redCustom font-semibold"
                        id={`rich_editor_error_${name}`}
                        data-testid={`rich_editor_error_${name}`}
                    >
                        {meta.error}
                    </label>
                </div>
            )}
            <div className="bg-white rounded-sm shadow-sm border border-gray-200 rounded-t-lg w-full">
                <LexicalComposer initialConfig={initialConfig}>
                    <ReadOnlyPlugin enabled={readOnly} />
                    <Toolbar
                        setValue={setValue}
                        name={name}
                        showFields={showFields}
                        loadingSave={loadingSave}
                        disabled={readOnly}
                        onPaste={onPaste}
                        onBlur={onBlur}
                        imageUpload={imageUpload}
                        sourceMode={sourceMode}
                        sourceHtml={sourceHtml}
                        onToggleSource={allowHtmlSource ? handleToggleSource : null}
                    />
                    {sourceMode ? (
                        <textarea
                            className="h-56 overflow-y-auto outline-none py-[15px] px-2.5 resize-none bg-background w-full font-mono text-sm"
                            value={sourceHtml}
                            onChange={(event) => setSourceHtml(event.target.value)}
                            disabled={readOnly}
                            id={`rich_editor_source_${name}`}
                            data-testid={`rich_editor_source_${name}`}
                        />
                    ) : (
                        <RichTextPlugin
                            contentEditable={
                                <ContentEditable
                                    className="h-56 overflow-y-auto outline-none py-[15px] px-2.5 resize-none text-ellipsis bg-background w-full"
                                    onBlur={() => {
                                        if (field?.onBlur) {
                                            field?.onBlur({
                                                target: { name: field?.name },
                                                persist: () => {},
                                            });
                                        }
                                    }}
                                    disabled={readOnly}
                                    id={`rich_editor_input_${name}`}
                                    data-testid={`rich_editor_input_${name}`}
                                />
                            }
                            ErrorBoundary={LexicalErrorBoundary}
                        />
                    )}
                    <HistoryPlugin />
                    <TablePlugin />
                    <NormalizeTableNodesPlugin />
                    <LoadHTML htmlString={looksLikeHtml(value) ? value : `<p>${value}</p>`} />
                </LexicalComposer>
            </div>
        </div>
    );
};

RichEditor.propTypes = {
    value: PropTypes.string,
    setValue: PropTypes.func,
    name: PropTypes.string,
    showFields: PropTypes.bool,
    autoSave: PropTypes.func,
    loadingSave: PropTypes.bool,
    field: PropTypes.object,
    meta: PropTypes.object,
    readOnly: PropTypes.bool,
    onPaste: PropTypes.func,
    onBlur: PropTypes.func,
    imageUpload: PropTypes.shape({
        templateId: PropTypes.string,
        keyService: PropTypes.string.isRequired,
        saveAttachment: PropTypes.func.isRequired,
    }),
    allowHtmlSource: PropTypes.bool,
};
