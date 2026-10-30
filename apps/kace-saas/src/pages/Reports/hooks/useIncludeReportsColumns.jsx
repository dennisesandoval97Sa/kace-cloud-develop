import { useCallback } from "react";
import { useTranslation } from "react-i18next";

import { Download } from "lucide-react";
import { formatDate } from "@/utils/src/utils/dateUtils";

const DATE_FORMAT = "dd/MM/yyyy HH:mm:ss";

/**
 * Hook to include custom columns in the Reports DataTable
 * Adds a download button column that allows users to download report files from S3
 */
const useIncludeReportsColumns = (downloadReport) => {
    const { t } = useTranslation();

    const includeReportsColumns = useCallback(
        ({ availableColumns }) => {
            if (!availableColumns) return [];

            const DATE_COLUMNS = ["initial_date", "end_date"];

            const schemaColumns = availableColumns.map((col) => {
                if (DATE_COLUMNS.includes(col.accessorKey)) {
                    return {
                        ...col,
                        cell: ({ row }) => {
                            const value = row?.original?.[col.accessorKey];
                            return <span>{formatDate(value, DATE_FORMAT)}</span>;
                        },
                    };
                }
                if (col.accessorKey === "status") {
                    return {
                        ...col,
                        cell: ({ row }) => {
                            const value = row?.original?.[col.accessorKey];
                            let statusClass = "bg-gray-100 text-gray-800 border-gray-200";
                            let statusLabel = value;

                            if (value === "pending") {
                                statusClass = "bg-yellow-50 text-yellow-700 border-yellow-200";
                                statusLabel = t("reports.status.pending", "Pendiente");
                            } else if (value === "in_progress") {
                                statusClass = "bg-blue-50 text-blue-700 border-blue-200 animate-pulse";
                                statusLabel = t("reports.status.inProgress", "En Proceso");
                            } else if (value === "completed") {
                                statusClass = "bg-green-50 text-green-700 border-green-200";
                                statusLabel = t("reports.status.completed", "Completado");
                            } else if (value === "failed") {
                                statusClass = "bg-red-50 text-red-700 border-red-200";
                                statusLabel = t("reports.status.failed", "Fallido");
                            }

                            return (
                                <span
                                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusClass}`}
                                >
                                    {statusLabel}
                                </span>
                            );
                        },
                    };
                }
                return col;
            });

            return [
                ...schemaColumns,
                {
                    id: "download_action",
                    accessorKey: "download_action",
                    header: t("reports.table.download", "Descargar"),
                    enableSorting: false,
                    enableColumnFilter: false,
                    enableHiding: false,
                    cell: ({ row }) => {
                        const original = row.original || {};
                        const hasFile = !!(
                            original.result?.s3Location ||
                            original.result?.presignedUrl ||
                            original.s3_file
                        );
                        return (
                            <button
                                type="button"
                                onClick={() => downloadReport?.(row.original)}
                                disabled={!hasFile}
                                className={`inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                                    hasFile
                                        ? "text-blue-600 hover:bg-blue-50 hover:text-blue-700"
                                        : "text-gray-400 cursor-not-allowed opacity-50"
                                }`}
                                data-testid={`btn_download_report_${row.original?.id}`}
                            >
                                <Download className="w-4 h-4" />
                                {hasFile
                                    ? t("reports.table.download", "Descargar")
                                    : t("reports.table.notAvailable", "No disponible")}
                            </button>
                        );
                    },
                },
            ];
        },
        [downloadReport, t],
    );

    return { includeReportsColumns };
};

export default useIncludeReportsColumns;
