import { t } from "i18next";
import { GeneralLoader, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui-shared";
import { Loader, ExternalLink } from "lucide-react";
import { PropTypes } from "prop-types";
import { formatDate } from "@/utils/main";

const NIVEL_KEYS = [
    "nivel1",
    "nivel2",
    "nivel3",
    "nivel4",
    "nivel5",
    "nivel6",
    "nivel7",
    "nivel8",
    "nivel9",
    "nivel10",
];

const getClasificacionText = (item) => {
    const values = NIVEL_KEYS.map((key) => item[key]).filter(Boolean);
    return values.length ? values.join(" --> ") : "—";
};

const formatCreatedAt = (value) => {
    if (!value) return "—";
    try {
        const date =
            typeof value === "object" && value?.date != null ? `${value.date} ${value.time || ""}`.trim() : value;
        return formatDate(date, "dd/MM/yyyy HH:mm");
    } catch {
        return String(value);
    }
};

const SubcasesPanel = ({
    row,
    subcasesPageByParent,
    loadingByParent,
    errorByParent,
    handleLoadMoreSubcases,
    openCaseAction,
}) => {
    const caseId = row.original.id;
    const caseIdString = caseId?.toString();
    const subcasosData = subcasesPageByParent[caseId] ||
        subcasesPageByParent[caseIdString] || { items: [], hasMore: false };
    const isLoading = loadingByParent[caseId] || loadingByParent[caseIdString];
    const error = errorByParent[caseId] || errorByParent[caseIdString];

    const handleOpenCase = (e, item) => {
        e.preventDefault();
        e.stopPropagation();
        if (openCaseAction) {
            openCaseAction(item.id, item.reference);
        }
    };

    const handleLoadMore = (e) => {
        e.preventDefault();
        e.stopPropagation();
        handleLoadMoreSubcases(caseId || caseIdString);
    };

    return (
        <div className="w-full border-b-[1px] border-gray-200 bg-gray-50">
            <div className="max-h-[28rem] overflow-y-auto p-4">
                {isLoading && !subcasosData.items.length ? (
                    <div className="flex items-center gap-2 justify-center py-8">
                        <GeneralLoader />
                    </div>
                ) : error ? (
                    <div className="text-red-500 text-center py-4">Error: {error}</div>
                ) : subcasosData.items.length > 0 ? (
                    <>
                        <div className="rounded-md border border-gray-200 bg-white overflow-y-auto max-h-[26rem]">
                            <table className="w-full caption-bottom text-sm border-collapse">
                                <TableHeader className="sticky top-0 z-10 bg-gray-50 shadow-[0_1px_0_0_rgba(0,0,0,0.06)]">
                                    <TableRow className="bg-gray-50 hover:bg-gray-50 border-b border-gray-200">
                                        <TableHead className="font-semibold text-gray-700 text-xs bg-gray-50">
                                            {t("gridMain.columns.reference")}
                                        </TableHead>
                                        <TableHead className="font-semibold text-gray-700 text-xs bg-gray-50">
                                            {t("gridMain.columns.created_at")}
                                        </TableHead>
                                        <TableHead className="font-semibold text-gray-700 text-xs bg-gray-50">
                                            {t("genericTexts.status")}
                                        </TableHead>
                                        <TableHead className="font-semibold text-gray-700 text-xs bg-gray-50">
                                            {t("genericTexts.client")}
                                        </TableHead>
                                        <TableHead className="font-semibold text-gray-700 text-xs bg-gray-50">
                                            {t("genericTexts.responsible")}
                                        </TableHead>
                                        <TableHead className="font-semibold text-gray-700 text-xs min-w-[140px] max-w-[240px] bg-gray-50">
                                            {t("gridMain.columns.classification")}
                                        </TableHead>
                                        <TableHead className="font-semibold text-gray-700 text-xs w-[100px] text-right bg-gray-50">
                                            {t("gridMain.columns.actions")}
                                        </TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {subcasosData.items.map((i) => (
                                        <TableRow
                                            key={i.id}
                                            className="border-b border-gray-100 last:border-0 hover:bg-gray-50/80"
                                        >
                                            <TableCell className="font-medium text-gray-900 text-sm py-2">
                                                {i.reference}
                                            </TableCell>
                                            <TableCell className="text-sm text-gray-600 py-2 whitespace-nowrap">
                                                {formatCreatedAt(i.created_at)}
                                            </TableCell>
                                            <TableCell className="text-sm py-2">
                                                <span className="text-gray-700">
                                                    {i.estadoActual || t("case.text.stateless")}
                                                </span>
                                            </TableCell>
                                            <TableCell
                                                className="text-sm text-gray-700 py-2 max-w-[200px] truncate"
                                                title={i.nombreCliente}
                                            >
                                                {i.nombreCliente}
                                            </TableCell>
                                            <TableCell className="text-sm text-gray-600 py-2">
                                                {[i.nombres, i.apellido1].filter(Boolean).join(" ") || "—"}
                                            </TableCell>
                                            <TableCell
                                                className="text-sm text-gray-600 py-2 max-w-[240px] truncate"
                                                title={getClasificacionText(i)}
                                            >
                                                {getClasificacionText(i)}
                                            </TableCell>
                                            <TableCell className="text-right py-2">
                                                {openCaseAction && (
                                                    <button
                                                        type="button"
                                                        onClick={(e) => handleOpenCase(e, i)}
                                                        className="inline-flex items-center gap-1.5 px-2 py-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
                                                    >
                                                        <ExternalLink className="w-3.5 h-3.5" />
                                                        {t("app.button.seeMore")}
                                                    </button>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </table>
                        </div>
                        {subcasosData.hasMore && (
                            <div className="flex justify-center mt-3">
                                <button
                                    onClick={handleLoadMore}
                                    disabled={isLoading}
                                    className="inline-flex items-center gap-2 px-5 py-2 bg-blue-500 text-white text-sm rounded-md hover:bg-blue-600 disabled:opacity-60 transition-colors font-medium"
                                >
                                    {isLoading ? <Loader className="w-4 h-4 animate-spin" /> : t("app.button.seeMore")}
                                </button>
                            </div>
                        )}
                    </>
                ) : (
                    <p className="text-center text-gray-500 py-6">{t("app.text.noSubcases")}</p>
                )}
            </div>
        </div>
    );
};

SubcasesPanel.propTypes = {
    row: PropTypes.object.isRequired,
    subcasesPageByParent: PropTypes.object.isRequired,
    loadingByParent: PropTypes.object.isRequired,
    errorByParent: PropTypes.object.isRequired,
    handleLoadMoreSubcases: PropTypes.func.isRequired,
    openCaseAction: PropTypes.func,
};

export default SubcasesPanel;
