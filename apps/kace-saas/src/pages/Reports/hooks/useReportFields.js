import { useQuery } from "@tanstack/react-query";

import { apiService } from "@kace/utils";

/**
 * Hook para obtener los campos disponibles de un reporte específico
 * @param {string} reportName - Nombre del reporte seleccionado
 * @returns {Object} { fields, isLoading, error }
 */
export const useReportFields = (reportName) => {
    const { data, isLoading, error } = useQuery({
        queryKey: ["report-fields", reportName],
        queryFn: async () => {
            if (!reportName) {
                return { fields: [] };
            }

            try {
                // Hacer POST a report-executions/search con el payload correcto
                const response = await apiService.post(`/report/search?name=${reportName}`, {
                    filter: [
                        {
                            field: "report_executions.deleted_at",
                            operator: "null",
                            value: `${reportName}`,
                            type: "AND",
                        },
                    ],
                    relationship: null,
                    limit: 0,
                    offset: 0,
                });

                // Transformar la respuesta a formato de opciones para el select
                const fields = response?.data?.fields || response?.data?.data?.fields || [];

                return {
                    fields: fields.map((field) => ({
                        value: field.name || field.value || field,
                        label: field.label || field.displayName || field.name || field,
                    })),
                };
            } catch (err) {
                return { fields: [] };
            }
        },
        enabled: !!reportName,
        staleTime: 5 * 60 * 1000, // 5 minutos
        retry: 1,
    });

    return {
        fields: data?.fields || [],
        isLoading,
        error,
    };
};
