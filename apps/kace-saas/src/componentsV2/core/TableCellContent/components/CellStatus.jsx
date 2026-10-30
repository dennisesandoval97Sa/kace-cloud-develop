import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import { useCaseStatusColorMap } from "../context/CaseStatusColorMapContext";
import {
    getCaseStateBadgeStyle,
    getImportStatusBadgeStyle,
    IMPORT_STATUS_VALUES,
    isCaseStateAccessorKey,
} from "@/pages/Cases/components/CaseDataTable/utils/caseStateStatus.util";
import { isEmptyClassificationValue } from "@/pages/Cases/components/CaseDataTable/utils/classificationLevels.util";
import { EmptyTableCell, formatTableCellValue } from "../utils/emptyTableCell";

const CellStatus = ({ row, accessorKey }) => {
    const { t } = useTranslation();
    const statusColorMap = useCaseStatusColorMap();
    const value = row.original[accessorKey];

    if (isEmptyClassificationValue(value)) {
        return <EmptyTableCell />;
    }

    const isImportStatus = IMPORT_STATUS_VALUES.has(value);
    const displayValue = isImportStatus
        ? t(`importExport.form.statuses.${value}`, { defaultValue: value })
        : formatTableCellValue(value);

    const translatedActive = [t("app.forms.active"), t("gridMain.text.isPrimary")];
    const translatedInactive = [t("app.forms.inactive"), t("gridMain.text.isSubclassification")];

    const caseStateStyle = isCaseStateAccessorKey(accessorKey) ? getCaseStateBadgeStyle(value, statusColorMap) : null;

    if (caseStateStyle) {
        return (
            <span className="inline-block rounded-md px-2 py-1 text-center font-medium" style={caseStateStyle}>
                {displayValue}
            </span>
        );
    }

    const usesImportPalette =
        isImportStatus ||
        accessorKey === "status" ||
        accessorKey === "is_active" ||
        translatedActive.includes(value) ||
        translatedInactive.includes(value);

    if (!usesImportPalette) {
        return <span>{displayValue}</span>;
    }

    const badgeStyle = getImportStatusBadgeStyle(value, translatedActive);

    return (
        <p className="py-1 px-2 rounded-full text-center" style={badgeStyle}>
            {displayValue}
        </p>
    );
};

CellStatus.propTypes = {
    row: PropTypes.object.isRequired,
    accessorKey: PropTypes.string.isRequired,
};

export default CellStatus;
