import PropTypes from "prop-types";
import DataTable from "@/componentsV2/core/DataTable";
import useDataTable from "@/hooks/useDataTable";
import { dataTableConfig } from "../data/constants";
import { processColumns, processData, processFilters } from "../utils/datatableProcess";

/**
 * Componente contenedor para la tabla de listas personalizadas.
 * Integra el hook useDataTable con procesamiento personalizado de datos, columnas y filtros.
 *
 * @component
 * @param {Object} props - Propiedades del componente
 * @param {Array<Object>} props.arrayAction - Array de acciones disponibles para cada fila de la tabla
 * @returns {JSX.Element} DataTable configurado con datos procesados
 */
export const CustomListTableContainer = ({ arrayAction = [] }) => {
    /*
     * Hook personalizado que gestiona el estado y lógica del DataTable
     * Incluye: datos renderizados, query de búsqueda, filtros, paginación y selector de columnas
     */
    const { renderData, query, filters, pagination, columnSelector } = useDataTable({
        dataTableConfig, // Configuración base del DataTable
        actions: arrayAction, // Acciones disponibles por fila
        processFilters, // Función para procesar filtros personalizados
        processColumns, // Función para procesar transformaciones de columnas
        processData, // Función para procesar datos antes de renderizar
    });

    return (
        <DataTable
            renderData={renderData}
            query={query}
            filters={filters}
            pagination={pagination}
            columnSelector={columnSelector}
        />
    );
};

CustomListTableContainer.propTypes = {
    arrayAction: PropTypes.array,
};
