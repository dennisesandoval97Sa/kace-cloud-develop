import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { Badge, Button } from "@/components/ui-shared";
import { CLASSIFICATION_LEVELS } from "./interactionCaseConstants";

const SAFE_DOM_ID_PART_PATTERN = /[^a-zA-Z0-9_-]+/g;
const EDGE_DASH_PATTERN = /^-+|-+$/g;

const isBlank = (value) => value === null || value === undefined || String(value).trim() === "";

const formatReference = (reference) => {
    if (isBlank(reference)) return "—";

    return `#${reference}`;
};

const formatDisplayValue = (value) => String(value).trim();

const getCaseDisplayLabel = (caseItem, index) => {
    if (!isBlank(caseItem?.reference)) return formatReference(caseItem.reference);
    if (!isBlank(caseItem?.id)) return formatDisplayValue(caseItem.id);

    return `Case ${index + 1}`;
};

const getSafeDomIdPart = (value) => {
    const safeValue = String(value ?? "case")
        .trim()
        .replace(SAFE_DOM_ID_PART_PATTERN, "-")
        .replace(EDGE_DASH_PATTERN, "");

    return safeValue || "case";
};

const getViewButtonId = (caseItem, index) =>
    `linked-case-view-${getSafeDomIdPart(isBlank(caseItem?.id) ? index : caseItem.id)}`;

const getClassificationSummary = (caseItem) => {
    const classification = CLASSIFICATION_LEVELS.map((level) => caseItem?.[level])
        .filter((value) => !isBlank(value))
        .map(formatDisplayValue)
        .join(" / ");

    return classification || "—";
};

const getResponsibleName = (caseItem) => caseItem?.responsible_name ?? caseItem?.responsible_login;

const getCaseMetadata = (caseItem) =>
    [caseItem?.estadoActual, getResponsibleName(caseItem)].filter((value) => !isBlank(value)).map(formatDisplayValue);

const LinkedInteractionCasesList = ({ cases = [], onViewCase }) => {
    const { t } = useTranslation();
    const viewCaseText = t("interactions.cases.viewCase", { defaultValue: "View Case" });

    return (
        <section className="rounded-xl border border-gray-200 bg-white p-3">
            <h3 className="text-sm font-bold text-gray-900">
                {t("interactions.cases.linkedCases", { defaultValue: "Linked Cases" })}
            </h3>

            {cases.length === 0 ? (
                <p className="mt-2 text-xs text-gray-500">
                    {t("interactions.cases.noLinkedCases", { defaultValue: "No linked Cases yet" })}
                </p>
            ) : (
                <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1" role="list">
                    {cases.map((caseItem, index) => {
                        const caseMetadata = getCaseMetadata(caseItem);
                        const caseDisplayLabel = getCaseDisplayLabel(caseItem, index);

                        return (
                            <article
                                key={caseItem.id ?? `${caseItem.reference ?? "case"}-${index}`}
                                className="rounded-lg border border-gray-200 bg-slate-50 p-2"
                                role="listitem"
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0 space-y-1">
                                        <p className="truncate text-sm font-semibold text-gray-900">
                                            {formatReference(caseItem.reference)}
                                        </p>
                                        <p className="truncate text-xs text-gray-600">
                                            {getClassificationSummary(caseItem)}
                                        </p>
                                    </div>

                                    {caseItem.parent_id ? (
                                        <Badge
                                            variant="outline"
                                            className="shrink-0 border-violet-200 bg-violet-50 px-2 py-0.5 text-[11px] text-violet-700"
                                        >
                                            {t("interactions.cases.subcase", { defaultValue: "Subcase" })}
                                        </Badge>
                                    ) : null}
                                </div>

                                {caseMetadata.length > 0 ? (
                                    <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-[11px] text-gray-500">
                                        {caseMetadata.map((metadata, metadataIndex) => (
                                            <span key={`${metadata}-${metadataIndex}`} className="truncate">
                                                {metadata}
                                            </span>
                                        ))}
                                    </div>
                                ) : null}

                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    id={getViewButtonId(caseItem, index)}
                                    aria-label={`${viewCaseText} ${caseDisplayLabel}`}
                                    className="mt-2 h-7 px-2 text-xs"
                                    onClick={() => onViewCase(caseItem)}
                                >
                                    {viewCaseText}
                                </Button>
                            </article>
                        );
                    })}
                </div>
            )}
        </section>
    );
};

LinkedInteractionCasesList.propTypes = {
    cases: PropTypes.arrayOf(
        PropTypes.shape({
            id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
            reference: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
            nivel1: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
            nivel2: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
            nivel3: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
            nivel4: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
            nivel5: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
            nivel6: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
            nivel7: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
            nivel8: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
            nivel9: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
            nivel10: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
            parent_id: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
            estadoActual: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
            responsible_name: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
            responsible_login: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
        }),
    ),
    onViewCase: PropTypes.func.isRequired,
};

export default LinkedInteractionCasesList;
