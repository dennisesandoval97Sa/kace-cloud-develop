import { Button } from "@kace/ui-shared";
import { Copy, Download } from "lucide-react";
import PropTypes from "prop-types";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { generateExampleValue } from "../data/proccessData";

export const CsvPreviewComponent = ({ headers = [] }) => {
    const { t } = useTranslation();
    const [showPreview, setShowPreview] = useState(false);

    if (!headers || headers.length === 0) {
        return null;
    }

    // Check if any headers are required
    const hasRequiredFields = headers.some((h) => h.required);

    // Generate CSV header row (add asterisk for required fields)
    const csvHeaders = headers
        .map((h) => {
            const columnName = h.nameColumn || h.value;
            return h.required ? `${columnName}*` : columnName;
        })
        .join(",");

    // Generate CSV example data row
    const csvExampleRow = headers.map((h) => generateExampleValue(h.type, h.nameColumn || h.value)).join(",");

    // Complete CSV content (without asterisks for the actual CSV file)
    const csvHeadersClean = headers.map((h) => h.nameColumn || h.value).join(",");
    const csvContent = `${csvHeadersClean}\n${csvExampleRow}`;

    const handleCopyToClipboard = () => {
        navigator.clipboard.writeText(csvContent);
        toast.success(t("app.alerts.CopiedToClipboard"));
    };

    const handleDownloadExample = () => {
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", "ejemplo_importacion.csv");
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success(t("app.alerts.DownloadStarted"));
    };

    return (
        <div className="p-4 m-2 border rounded-lg bg-gray-50">
            <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-semibold text-gray-700">{t("importExport.form.csvExample")}</h3>
                <Button
                    onClick={() => setShowPreview(!showPreview)}
                    type="button"
                    variant="flat"
                    size="sm"
                    className="bg-primary text-xs text-white hover:text-foreground hover:bg-purple-custom transition-colors"
                    data-testid="toggle_csv_preview"
                >
                    {showPreview ? t("auxSchema.actions.hide") : t("auxSchema.actions.show")}
                </Button>
            </div>

            {showPreview && (
                <div className="space-y-3">
                    {/* Required fields note */}
                    {hasRequiredFields && (
                        <div className="text-xs text-amber-700 bg-amber-50 p-2 rounded border border-amber-200">
                            <span className="font-semibold">⚠️ {t("importExport.form.requiredFieldsNote")}</span>
                        </div>
                    )}

                    {/* CSV Preview */}
                    <div className="bg-white border rounded p-3 font-mono text-xs overflow-x-auto">
                        <div className="text-green-700 font-semibold mb-1"># {t("importExport.form.headers")}</div>
                        <div className="mb-2">{csvHeaders}</div>
                        <div className="text-green-700 font-semibold mb-1"># {t("importExport.form.exampleData")}</div>
                        <div>{csvExampleRow}</div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                        <button
                            onClick={handleCopyToClipboard}
                            className="flex items-center gap-2 px-3 py-2 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                            data-testid="copy_csv_button"
                        >
                            <Copy size={14} />
                            {t("app.actions.copy")}
                        </button>
                        <button
                            onClick={handleDownloadExample}
                            className="flex items-center gap-2 px-3 py-2 text-xs bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
                            data-testid="download_csv_button"
                        >
                            <Download size={14} />
                            {t("app.actions.downloadExample")}
                        </button>
                    </div>

                    {/* Instructions */}
                    <div className="text-xs text-gray-600 bg-blue-50 p-3 rounded border border-blue-200">
                        <p className="font-semibold mb-1">📋 {t("importExport.form.instructions")}</p>
                        <ul className="list-disc list-inside space-y-1">
                            <li>{t("importExport.form.instruction1")}</li>
                            <li>{t("importExport.form.instruction2")}</li>
                            <li>{t("importExport.form.instruction3")}</li>
                        </ul>
                    </div>
                </div>
            )}
        </div>
    );
};

CsvPreviewComponent.propTypes = {
    headers: PropTypes.arrayOf(
        PropTypes.shape({
            value: PropTypes.string,
            nameColumn: PropTypes.string,
            type: PropTypes.string,
            label: PropTypes.string,
            required: PropTypes.bool,
        }),
    ),
};
