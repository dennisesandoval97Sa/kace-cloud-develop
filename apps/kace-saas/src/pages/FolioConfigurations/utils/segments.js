/**
 * A segment the user has just added carries the empty defaults of its type
 * (`SEGMENT_DEFAULTS.literal` starts with `value: ""`), and the API rejects those:
 * `"segments[n].value" is not allowed to be empty`.
 *
 * Shared by the form, to block the submit, and by the preview, to skip the request while
 * the row is still being filled in.
 */
export const isSegmentComplete = (segment) => {
    if (segment.type === "literal") return Boolean(segment.value);
    if (segment.type === "field") return Boolean(segment.path);
    if (segment.type === "date") return Boolean(segment.format);
    if (segment.type === "sequence") return Boolean(segment.length);
    return true;
};

/**
 * The first reason the segment list would be rejected, as an i18n key, or null when the API
 * would accept its shape. The single rule behind both the submit guard and the preview.
 *
 * Range checks (digits, pad char, start value, `prefix` policy) are left to the domain on
 * purpose: the preview sends the draft to it and shows its message inline.
 */
export const getSegmentsProblem = (segments) => {
    if (!segments?.length) return "folioConfigurations.messages.minSegment";
    if (segments.filter((segment) => segment.type === "sequence").length !== 1) {
        return "folioConfigurations.messages.exactlyOneSequence";
    }
    if (!segments.every(isSegmentComplete)) return "folioConfigurations.messages.incompleteSegment";
    return null;
};

/** Exactly one consecutive and no half-filled rows: what the API accepts. */
export const isPreviewable = (segments) => getSegmentsProblem(segments) === null;
