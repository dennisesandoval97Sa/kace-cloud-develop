import { useNavigate } from "react-router-dom";

import useGeneralDelete from "@/hooks/useGeneralDelete";
import { REPORTS_SERVICE } from "@/utils/URL";

import { REPORTS_PATH, dataTableConfig } from "../data/constants";
import { useReportDownload } from "./useReportDownload";

/**
 * Hook personalizado que proporciona las acciones CRUD para reportes.
 * Incluye navegación, eliminación optimista, descarga y manejo de errores.
 *
 * @hook
 * @returns {Object} Objeto con los handlers para las acciones de reportes
 * @returns {Function} returns.handleUpdateReport - Navega a la página de edición
 * @returns {Function} returns.handleDeleteReport - Elimina un reporte
 * @returns {Function} returns.handleSeeReport - Navega a la vista de solo lectura
 * @returns {Function} returns.handleDownloadReport - Descarga el archivo del reporte desde S3
 */
const useReportsActions = () => {
    const navigate = useNavigate();
    const { downloadReport } = useReportDownload();

    const { mutate } = useGeneralDelete({
        keyQuery: dataTableConfig.key,
    });

    return {
        handleUpdateReport: (id) => {
            navigate(`${REPORTS_PATH}/update/${id}`);
        },

        handleDeleteReport: (id) => {
            mutate({ id, url: REPORTS_SERVICE });
        },

        handleSeeReport: (id) => {
            navigate(`${REPORTS_PATH}/update/${id}?action=see`);
        },

        handleDownloadReport: (row) => {
            downloadReport(row);
        },
    };
};

export default useReportsActions;
