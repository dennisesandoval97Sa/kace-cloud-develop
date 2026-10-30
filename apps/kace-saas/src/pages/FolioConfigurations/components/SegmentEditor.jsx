import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { InputForm as Input, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@kace/ui-shared";
import { ArrowDown, ArrowUp, Trash2 } from "lucide-react";
import FieldPathPicker from "./FieldPathPicker";
import { DATE_FORMATS, MAX_SEQUENCE_LENGTH, SEGMENT_DEFAULTS, SEGMENT_TYPES } from "../data/constants";

/**
 * One row of the segment list. Switching the type swaps in that type's defaults rather
 * than keeping stale params from the previous type, which the API would reject anyway
 * (each segment type forbids the others' parameters).
 */
const SegmentEditor = ({ segment, index, total, disabled, onChange, onRemove, onMove }) => {
    const { t } = useTranslation();

    const patch = (changes) => onChange(index, { ...segment, ...changes });
    // One id per control and row, so each label is announced with the control it describes.
    const controlId = (control) => `folio_segment_${control}_${index}`;

    return (
        <div
            className="flex flex-wrap items-end gap-3 rounded-md border border-border p-3"
            data-testid={`folio_segment_${index}`}
        >
            <div className="w-40">
                <label htmlFor={controlId("type")} className="text-xs text-muted-foreground">
                    {t("folioConfigurations.segments.type")}
                </label>
                <Select
                    value={segment.type}
                    onValueChange={(type) => onChange(index, { ...SEGMENT_DEFAULTS[type] })}
                    disabled={disabled}
                >
                    <SelectTrigger id={controlId("type")} data-testid={`folio_segment_type_${index}`}>
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {SEGMENT_TYPES.map((option) => (
                            <SelectItem key={option.value} value={option.value}>
                                {t(option.labelKey)}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {segment.type === "literal" && (
                <div className="w-40">
                    <label htmlFor={controlId("value")} className="text-xs text-muted-foreground">
                        {t("folioConfigurations.segments.value")}
                    </label>
                    <Input
                        name={controlId("value")}
                        value={segment.value ?? ""}
                        onChange={(e) => patch({ value: e.target.value })}
                        disabled={disabled}
                        data-testid={`folio_segment_value_${index}`}
                    />
                </div>
            )}

            {segment.type === "date" && (
                <div className="w-40">
                    <label htmlFor={controlId("format")} className="text-xs text-muted-foreground">
                        {t("folioConfigurations.segments.format")}
                    </label>
                    <Select value={segment.format} onValueChange={(format) => patch({ format })} disabled={disabled}>
                        <SelectTrigger id={controlId("format")} data-testid={`folio_segment_format_${index}`}>
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {DATE_FORMATS.map((format) => (
                                <SelectItem key={format} value={format}>
                                    {format}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}

            {segment.type === "field" && (
                <div className="min-w-full flex-1 sm:min-w-[22rem]">
                    <label htmlFor={controlId("origin")} className="text-xs text-muted-foreground">
                        {t("folioConfigurations.segments.path")}
                    </label>
                    <FieldPathPicker
                        id={controlId("origin")}
                        value={segment.path}
                        onChange={(path) => patch({ path })}
                        disabled={disabled}
                    />
                </div>
            )}

            {segment.type === "sequence" && (
                <>
                    <div className="w-28">
                        <label htmlFor={controlId("length")} className="text-xs text-muted-foreground">
                            {t("folioConfigurations.segments.length")}
                        </label>
                        <Input
                            name={controlId("length")}
                            type="number"
                            min={1}
                            max={MAX_SEQUENCE_LENGTH}
                            value={segment.length ?? ""}
                            onChange={(e) => patch({ length: Number(e.target.value) })}
                            disabled={disabled}
                            data-testid={`folio_segment_length_${index}`}
                        />
                    </div>
                    <div className="w-24">
                        <label htmlFor={controlId("pad")} className="text-xs text-muted-foreground">
                            {t("folioConfigurations.segments.padChar")}
                        </label>
                        <Input
                            name={controlId("pad")}
                            maxLength={1}
                            value={segment.pad_char ?? "0"}
                            onChange={(e) => patch({ pad_char: e.target.value.replace(/[1-9]/g, "") })}
                            disabled={disabled}
                            data-testid={`folio_segment_pad_${index}`}
                        />
                    </div>
                </>
            )}

            <div className="ml-auto flex gap-1">
                <button
                    type="button"
                    onClick={() => onMove(index, -1)}
                    disabled={disabled || index === 0}
                    title={t("folioConfigurations.segments.moveUp")}
                    aria-label={t("folioConfigurations.segments.moveUp")}
                    className="rounded p-2 disabled:opacity-30"
                    data-testid={`folio_segment_up_${index}`}
                >
                    <ArrowUp size={16} />
                </button>
                <button
                    type="button"
                    onClick={() => onMove(index, 1)}
                    disabled={disabled || index === total - 1}
                    title={t("folioConfigurations.segments.moveDown")}
                    aria-label={t("folioConfigurations.segments.moveDown")}
                    className="rounded p-2 disabled:opacity-30"
                    data-testid={`folio_segment_down_${index}`}
                >
                    <ArrowDown size={16} />
                </button>
                <button
                    type="button"
                    onClick={() => onRemove(index)}
                    disabled={disabled}
                    title={t("folioConfigurations.segments.remove")}
                    aria-label={t("folioConfigurations.segments.remove")}
                    className="rounded p-2 disabled:opacity-30"
                    data-testid={`folio_segment_remove_${index}`}
                >
                    <Trash2 size={16} />
                </button>
            </div>
        </div>
    );
};

SegmentEditor.propTypes = {
    segment: PropTypes.object.isRequired,
    index: PropTypes.number.isRequired,
    total: PropTypes.number.isRequired,
    disabled: PropTypes.bool,
    onChange: PropTypes.func.isRequired,
    onRemove: PropTypes.func.isRequired,
    onMove: PropTypes.func.isRequired,
};

export default SegmentEditor;
