import { useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import useGeneralDelete from "@kace/hooks/useGeneralDelete";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";
import { downloadBoardExport } from "@kace_v2/features/boards/utils/downloadBoardExport.util";

/**
 * Acciones por fila del listado de tableros: ver, editar, eliminar y descargar.
 *
 * La descarga se lanza sin criterio: desde el listado no hay filtros de pantalla del
 * tablero, asi que se exporta su conjunto de datos por defecto.
 */
const useBoardsListActions = () => {
    const navigate = useNavigate();
    const { t } = useTranslation();
    /*
     * Ids con una exportacion en vuelo. Va en un ref, no en estado: la guarda tiene que
     * ver el valor ya escrito en el mismo tick (un doble clic rapido burlaria a useState,
     * que no se aplica hasta el siguiente render) y ademas nada de esto se pinta, asi que
     * un cambio de estado solo serviria para recrear los handlers y re-renderizar la tabla.
     */
    const downloadingBoardIds = useRef(new Set());

    const { mutate: deleteAction } = useGeneralDelete({
        keyQuery: URL_AND_KEYS.boards.key,
    });

    const handleSeeBoard = useCallback((id) => navigate(`/boards/${id}`), [navigate]);

    const handleUpdateBoard = useCallback((id) => navigate(`/boards/update/${id}`), [navigate]);

    const handleDeleteBoard = useCallback((id) => deleteAction({ id, url: URL_AND_KEYS.boards.url }), [deleteAction]);

    const handleDownloadBoard = useCallback(
        async (id) => {
            /*
             * Una exportacion en curso por fila: el menu se cierra al elegir la accion, asi
             * que sin esta guarda un doble clic rapido lanzaria dos veces la misma descarga.
             * Dos tableros distintos si pueden descargarse a la vez.
             */
            if (downloadingBoardIds.current.has(id)) return;

            downloadingBoardIds.current.add(id);
            try {
                await downloadBoardExport(id, {}, t);
            } finally {
                downloadingBoardIds.current.delete(id);
            }
        },
        [t],
    );

    return {
        handleSeeBoard,
        handleUpdateBoard,
        handleDeleteBoard,
        handleDownloadBoard,
    };
};

export default useBoardsListActions;
