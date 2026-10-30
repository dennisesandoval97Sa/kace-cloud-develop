import { CUSTOM_LISTS_SERVICE } from "@/utils/URL";
import { useNavigate } from "react-router-dom";
import useGeneralDelete from "@/hooks/useGeneralDelete";
import { CUSTOM_LISTS_PATH, dataTableConfig } from "../data/constants";

/**
 * Hook personalizado que proporciona las acciones CRUD para listas personalizadas.
 * Incluye navegación, eliminación optimista y manejo de errores.
 *
 * @hook
 * @returns {Object} Objeto con los handlers para las acciones de listas personalizadas
 * @returns {Function} returns.handleUpdateCustomList - Navega a la página de edición
 * @returns {Function} returns.handleDeleteCustomList - Elimina una lista personalizada
 * @returns {Function} returns.handleSeeCustomList - Navega a la vista de solo lectura
 */
const useCustomListActions = () => {
    // Hook de navegación de React Router
    const navigate = useNavigate();

    const { mutate } = useGeneralDelete({
        keyQuery: dataTableConfig.key,
    });

    return {
        /**
         * Navega a la página de edición de una lista personalizada
         * @param {string|number} id - ID de la lista personalizada a editar
         */
        handleUpdateCustomList: (id) => {
            navigate(`${CUSTOM_LISTS_PATH}/update/${id}`);
        },

        /**
         * Elimina una lista personalizada por su ID
         * @param {string|number} id - ID de la lista personalizada a eliminar
         */
        handleDeleteCustomList: (id) => {
            mutate({ id, url: CUSTOM_LISTS_SERVICE });
        },

        /**
         * Navega a la vista de solo lectura de una lista personalizada
         * @param {string|number} id - ID de la lista personalizada a visualizar
         */
        handleSeeCustomList: (id) => {
            navigate(`${CUSTOM_LISTS_PATH}/update/${id}?action=see`);
        },
    };
};

export default useCustomListActions;
