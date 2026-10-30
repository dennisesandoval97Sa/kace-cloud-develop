import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import SegmentEditor from "./SegmentEditor";
import { SEGMENT_DEFAULTS } from "../data/constants";

/**
 * Ordered list of the segments a folio is built from. The order is the folio: segments
 * are concatenated top to bottom.
 */
const SegmentBuilder = ({ segments = [], onChange, disabled = false }) => {
    const { t } = useTranslation();

    const sequenceCount = segments.filter((segment) => segment.type === "sequence").length;

    const replaceAt = (index, segment) => onChange(segments.map((s, i) => (i === index ? segment : s)));

    const removeAt = (index) => onChange(segments.filter((_, i) => i !== index));

    const move = (index, delta) => {
        const target = index + delta;
        if (target < 0 || target >= segments.length) return;
        const next = [...segments];
        [next[index], next[target]] = [next[target], next[index]];
        onChange(next);
    };

    const add = () => onChange([...segments, { ...SEGMENT_DEFAULTS.literal }]);

    return (
        <div className="flex flex-col gap-3">
            {segments.map((segment, index) => (
                <SegmentEditor
                    // Segments are reordered by index, so index is the identity here.
                    key={`segment-${index}`}
                    segment={segment}
                    index={index}
                    total={segments.length}
                    disabled={disabled}
                    onChange={replaceAt}
                    onRemove={removeAt}
                    onMove={move}
                />
            ))}

            {!disabled && (
                <button
                    type="button"
                    onClick={add}
                    className="flex w-fit items-center gap-2 rounded-md border border-dashed px-3 py-2 text-sm"
                    data-testid="folio_segment_add"
                >
                    <Plus size={16} />
                    {t("folioConfigurations.segments.add")}
                </button>
            )}

            {/* The API rejects this too, but saying it here saves a round trip. */}
            {sequenceCount !== 1 && (
                <p className="text-sm text-destructive" role="alert" data-testid="folio_segment_sequence_error">
                    {t("folioConfigurations.segments.exactlyOneSequence", { count: sequenceCount })}
                </p>
            )}
        </div>
    );
};

SegmentBuilder.propTypes = {
    segments: PropTypes.array,
    onChange: PropTypes.func.isRequired,
    disabled: PropTypes.bool,
};

export default SegmentBuilder;
