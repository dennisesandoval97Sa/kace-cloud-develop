import { useState } from "react";
import PropTypes from "prop-types";
import { CheckCircle, Save, X } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

import { Button } from "@kace/ui-shared";
import { sendInformation } from "@/services/generic-send-information";
import useUserInformation from "@/hooks/useUserInformation";
import { formatDateTime } from "../utils/formatDateTime";
import { ErrorIcon, InformationIcon, LoadingIcon, TestIcon } from "../utils/icons";
import { useNavigate } from "react-router-dom";

/**
 * Genera el nombre automático del reporte
 * Formato: nombre_vista_YYYYMMDD
 * Ejemplo: reports_case_details_20260326
 */
const generateReportName = (reportViewName = "report") => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    const normalizedViewName = String(reportViewName).trim().replace(/\s+/g, "_");
    return `${normalizedViewName}_${year}${month}${day}`;
};

export const TestDataModal = ({ isOpen, onClose, data }) => {
    const [isSaving, setIsSaving] = useState(false);
    const { t } = useTranslation();
    const { user } = useUserInformation();
    const navigate = useNavigate();

    if (!isOpen) return null;

    const hasSuccessResponse = data?.response && data?.status === 200;
    const s3File = data?.response?.data?.s3Location || null;

    /*
     * Generar nombre automáticamente
     */
    const reportName = generateReportName(data?.request?.report);

    const handleSaveReport = async () => {
        if (!s3File) {
            toast.error("No hay archivo S3 disponible para guardar");
            return;
        }

        if (!user?.id) {
            toast.error("No se pudo obtener el ID del usuario");
            return;
        }

        const savePayload = {
            name: reportName,
            issuedBy: user.id,
            period: data.request.period,
            conditions: data.request.conditions,
            s3File,
        };

        setIsSaving(true);
        try {
            await sendInformation({
                url: "/report-executions",
                dataPost: savePayload,
            });

            toast.success("Reporte guardado exitosamente");
            onClose();
        } catch (error) {
            const errorMessage = error?.response?.data?.message || error?.message || "Error al guardar el reporte";

            toast.error(errorMessage);
        } finally {
            setIsSaving(false);
            navigate(-1);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-gray-200">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                            <TestIcon />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">{t("reports.modal.title")}</h2>
                        </div>
                    </div>
                    <Button
                        type="button"
                        onClick={onClose}
                        variant="ghost"
                        size="icon"
                        className="text-gray-400 hover:text-gray-600"
                        data-testid="btn_close_test_modal"
                    >
                        <X className="w-5 h-5" />
                    </Button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-auto p-6">
                    {/* Confirmación de reporte generado - Solo si hay respuesta exitosa */}
                    {hasSuccessResponse && (
                        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                            <div className="flex items-start gap-3">
                                <div className="flex-shrink-0">
                                    <CheckCircle className="w-5 h-5 text-green-600 mt-1" />
                                </div>
                                <div className="flex-1">
                                    <h3 className="font-semibold text-green-900 text-sm mb-2">
                                        {t("reports.modal.modalSuccess")}
                                    </h3>
                                    <p className="text-sm text-green-800 mb-2">
                                        {t("reports.modal.modalSuccessGeneratedandSave")}
                                    </p>
                                    <div className="mt-2 p-2 bg-white border border-green-300 rounded">
                                        <code className="text-sm font-mono text-gray-800">{reportName}</code>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Información adicional */}
                    <div className="mt-6 space-y-3">
                        {data?.error ? (
                            <div className="flex items-start gap-2 p-4 bg-red-50 border border-red-200 rounded-lg">
                                <ErrorIcon />
                                <div className="flex-1">
                                    <h3 className="font-semibold text-red-900 text-sm">
                                        {t("reports.modal.reportError")}
                                    </h3>
                                    <p className="text-sm text-red-800 mt-1">{data.error.message}</p>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-start gap-2 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                <InformationIcon />
                                <div className="flex-1">
                                    <h3 className="font-semibold text-blue-900 text-sm">
                                        {t("reports.modal.modalInformationFile")}
                                    </h3>
                                    <ul className="mt-2 text-sm text-blue-800 space-y-1">
                                        <li>
                                            <strong>{t("reports.modal.reportName")}:</strong>{" "}
                                            {data?.request?.report || "N/A"}
                                        </li>
                                        <li>
                                            <strong>{t("reports.modal.reportPeriod")}:</strong>{" "}
                                            {formatDateTime(data?.request?.period?.initialDate) || "N/A"}{" "}
                                            {t("reports.modal.to")}{" "}
                                            {formatDateTime(data?.request?.period?.endDate) || "N/A"}
                                        </li>
                                        <li>
                                            <strong>{t("reports.form.conditions")}:</strong>{" "}
                                            {data?.request?.conditions?.length > 0
                                                ? `${data.request.conditions.length} ${t("reports.modal.conditionsApplied")}`
                                                : t("reports.modal.noConditions")}
                                        </li>
                                    </ul>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="flex justify-between items-center gap-3 p-6 border-t border-gray-200 bg-gray-50">
                    <Button type="button" onClick={onClose} variant="outline" data-testid="btn_cancel_test_modal">
                        {t("reports.modal.closeBtn")}
                    </Button>

                    {/* Botón de Guardar Reporte - Solo si hay respuesta exitosa */}
                    {hasSuccessResponse && (
                        <Button
                            type="button"
                            onClick={handleSaveReport}
                            variant="default"
                            className="flex items-center gap-2"
                            disabled={isSaving}
                            data-testid="btn_save_report"
                        >
                            {isSaving ? (
                                <>
                                    <LoadingIcon opacity="25" />
                                    <span>{t("reports.modal.saving")}</span>
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4" />
                                    <span>{t("reports.modal.save")}</span>
                                </>
                            )}
                        </Button>
                    )}
                </div>
            </div>
        </div>
    );
};

TestDataModal.propTypes = {
    isOpen: PropTypes.bool.isRequired,
    onClose: PropTypes.func.isRequired,
    data: PropTypes.object.isRequired,
};
