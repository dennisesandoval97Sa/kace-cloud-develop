import { toast } from "sonner";
import { findPublicErrorCode, PUBLIC_ERROR_CODES } from "@kace/error-codes";
import { exportBoardResources } from "../services/boards.service";

/*
 * Respaldo para backends que todavia no envian el codigo publico. Se conserva porque el
 * status es el mismo que el de un fallo real y sin una de las dos senales no hay forma de
 * distinguir "no hay datos"; en cuanto el codigo llegue siempre, esta comparacion sobra.
 */
const NO_RECORDS_MESSAGE = "No se encontraron registros";

/**
 * Exporta los registros de un tablero y abre el fichero resultante.
 *
 * El backend aplica el criterio propio del tablero (columnas, relaciones, orden), asi que
 * `criteria` solo lleva el filtro ad-hoc de la pantalla: desde el listado se envia vacio y
 * se exporta el conjunto por defecto del tablero.
 *
 * La descarga no se hace en la pagina: el servicio devuelve una URL prefirmada de S3 que se
 * abre en una pestana nueva.
 *
 * @param {string} boardId
 * @param {Object} [criteria] Filtro ad-hoc aplicado en pantalla, si lo hay.
 * @param {Function} t Traductor de i18next.
 * @param {string|null} [activeClientId] Cliente activo del agente, para tableros con criterio `active_client`.
 * @returns {Promise<void>}
 */
export const downloadBoardExport = async (boardId, criteria, t, activeClientId = null) => {
    /*
     * El mapeo de errores va en su propio `catch` alrededor de la peticion, no en la cadena
     * completa: las validaciones de la respuesta lanzan mensajes ya traducidos y no deben
     * volver a pasar por el, que los reescribiria como error generico.
     */
    const request = (async () => {
        let response;

        try {
            response =
                typeof activeClientId === "string" && activeClientId.length > 0
                    ? await exportBoardResources(boardId, criteria ?? {}, activeClientId)
                    : await exportBoardResources(boardId, criteria ?? {});
        } catch (error) {
            // Defensa en profundidad: el backend ya recorta el listado por acceso, pero
            // /resources vuelve a comprobarlo y puede cortar con 403.
            if (error?.response?.status === 403) {
                throw new Error(t("boards.list.noAccessToBoard"));
            }
            const publicErrorCode = findPublicErrorCode(error?.response?.data?.data?.code, error?.response?.data?.code);
            const message = error?.response?.data?.errors?.[0]?.message || "";
            if (
                publicErrorCode === PUBLIC_ERROR_CODES.BOARD_EXPORT_NO_RECORDS ||
                message.includes(NO_RECORDS_MESSAGE)
            ) {
                throw new Error(t("importExport.form.noRecords"));
            }
            throw new Error(t("importExport.form.error"));
        }

        const downloadUrl = response?.data?.downloadUrl;

        /*
         * Sin URL no hay descarga: hay que rechazar para que el toast no anuncie un exito
         * que nunca ocurre. Es la otra forma que tiene el backend de decir "sin registros".
         */
        if (!downloadUrl) {
            throw new Error(t("importExport.form.noRecords"));
        }

        // Solo https: la URL la da el backend, pero abrirla es ceder el control del esquema.
        if (!/^https:\/\//.test(downloadUrl)) {
            throw new Error(t("importExport.form.error"));
        }

        window.open(downloadUrl, "_blank", "noopener,noreferrer");
    })();

    /*
     * `toast.promise` devuelve el id del toast, no una promesa: sin `unwrap()` el `await`
     * resolvia de inmediato y los spinners y guardas de los llamadores no esperaban nada.
     * El `catch` final evita que el rechazo —que el toast ya pinta— llegue a unos llamadores
     * que solo tienen `try/finally`.
     */
    await toast
        .promise(request, {
            loading: t("importExport.form.loading"),
            success: t("importExport.form.success"),
            position: "top-center",
            duration: 5000,
            className: "bg-blue-400",
            error: (e) => e.message,
        })
        .unwrap()
        .catch(() => {});
};
