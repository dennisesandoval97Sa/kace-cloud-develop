import { useQuery } from "@tanstack/react-query";

import { apiService } from "@kace/utils";

/**
 * Hook para obtener los valores únicos de un campo en una vista de reporte.
 * Se usa para poblar el MultiSelect cuando el operador es "en la lista" o "no en la lista".
 * @param {string} reportName - Nombre del reporte/vista
 * @param {string} fieldName - Nombre del campo a consultar
 * @returns {{ data: Array<{id, label, value}>, isLoading: boolean }}
 */
export const useReportDistinctValues = (reportName, fieldName) => {
    const { data, isLoading } = useQuery({
        queryKey: ["report-distinct-values", reportName, fieldName],
        queryFn: async () => {
            const response = await apiService.post(`/reports/advance-search?name=${reportName}&field=${fieldName}`, {});
            return response?.data?.data ?? [];
        },
        enabled: !!reportName && !!fieldName,
        staleTime: 1000 * 60 * 10,
        retry: 1,
    });

    return {
        data: data ?? [],
        isLoading,
    };
};
