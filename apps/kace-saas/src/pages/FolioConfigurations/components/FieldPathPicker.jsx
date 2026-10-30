import { useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import { ComboBox, Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@kace/ui-shared";
import { useTranslation } from "react-i18next";
import useModelsData from "@/pages/Actions/hooks/useModelsData";
import { UNRESOLVABLE_PATHS } from "@kace/core/src/folio-configurations/domain/segments/segmentCatalog.js";

/**
 * Picks the dotted path of a `field` segment, as two controls: the origin and then the
 * field within it. Same shape as the action-rules selector (FieldSelectorCustom), so case
 * fields and auxiliary fields never share one long list.
 *
 * Deliberately built on `useModelsData` — the same hook that feeds that selector — so the
 * paths offered here are byte-for-byte the ones the rest of the product uses
 * (`aux_cases.<form>.<grupo>.<campo>`, `cases.<col>`) and the backend resolves them with
 * the same RuleValidator.getFieldValue.
 *
 * FieldSelectorCustom itself is not reused because it reads the rule builder's Formik
 * context (`values.entity`), which does not exist inside a segment list.
 */
const ORIGIN_OPTIONS = [
    { value: "cases", labelKey: "actions.form.cases" },
    { value: "aux_cases", labelKey: "actions.form.auxCase" },
];

/** The path already carries its origin, so the segment keeps storing just `path`. */
const originOf = (path) => (typeof path === "string" && path.includes(".") ? path.split(".")[0] : "");

const FieldPathPicker = ({ id, value, onChange, disabled = false }) => {
    const { t } = useTranslation();
    const { opcionesBuilder, loading } = useModelsData({});
    const [origin, setOrigin] = useState(() => originOf(value) || ORIGIN_OPTIONS[0].value);

    /*
     * Reopening a saved configuration: the path arrives after mount and brings its origin.
     * Changing the origin by hand clears `value` first, so this never fights the user.
     */
    useEffect(() => {
        const saved = originOf(value);
        if (saved) setOrigin(saved);
    }, [value]);

    /*
     * `clasificaciones.*` is no longer offered, but the backend still resolves it. Keeping the
     * stored origin listed stops an older configuration from showing an empty control that the
     * administrator would overwrite without noticing.
     */
    const originOptions = useMemo(() => {
        const saved = originOf(value);
        if (!saved || ORIGIN_OPTIONS.some((option) => option.value === saved)) return ORIGIN_OPTIONS;
        return [...ORIGIN_OPTIONS, { value: saved, label: saved }];
    }, [value]);

    const options = useMemo(() => {
        const group = opcionesBuilder.find((item) => item.dataOrigin === origin);
        return (group?.options ?? []).filter((option) => !UNRESOLVABLE_PATHS.includes(option.value));
    }, [opcionesBuilder, origin]);

    const handleOriginChange = (next) => {
        setOrigin(next);
        if (originOf(value) !== next) onChange("");
    };

    return (
        <div className="flex flex-col gap-2 lg:flex-row">
            <div className="min-w-0 lg:w-52">
                <Select value={origin} onValueChange={handleOriginChange} disabled={disabled}>
                    <SelectTrigger id={id} data-testid="folio_segment_origin">
                        <SelectValue placeholder={t("actions.placeholder.categories")} />
                    </SelectTrigger>
                    <SelectContent>
                        {originOptions.map((option) => (
                            <SelectItem
                                key={option.value}
                                value={option.value}
                                data-testid={`folio_segment_origin_${option.value}`}
                            >
                                {option.labelKey ? t(option.labelKey) : option.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            <div className="min-w-0 flex-1" data-testid="folio_segment_path">
                <ComboBox
                    data={options}
                    defaultValue={value ?? ""}
                    handleOnChange={onChange}
                    loading={loading}
                    disabled={disabled}
                    placeholder={t("folioConfigurations.segments.pathPlaceholder")}
                    classNamePopover="md:w-[calc(100vw-20rem)] lg:w-[calc(70vw-20rem)]"
                    dataTestId="folio_segment_path"
                    truncateLabel
                />
            </div>
        </div>
    );
};

FieldPathPicker.propTypes = {
    /** Id of the first control, so an outer `<label htmlFor>` can point at it. */
    id: PropTypes.string,
    value: PropTypes.string,
    onChange: PropTypes.func.isRequired,
    disabled: PropTypes.bool,
};

export default FieldPathPicker;
