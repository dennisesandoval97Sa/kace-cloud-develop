import useGeneralMutation from "@kace/hooks/useGeneralMutation";
import { QUERY_KEYS } from "@kace_v2/shared/constants/query-keys.constants";
import { useCallback } from "react";
import { genericHandleSendInformation } from "@/services/genericHandleSendInformation";
import useGeneralDelete from "@kace/hooks/useGeneralDelete";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { BOARDS_DEFAULT_PAGE_SIZE } from "@kace_v2/features/boards/constants/boards.constants";
import { toOptionalInt } from "@kace_v2/features/boards/utils/toOptionalInt.util";
import useBoardFormReturn from "@kace_v2/features/boards/hooks/useBoardFormReturn.hook";

/*
 * useGeneralDelete y useGeneralMutation envuelven la key recibida (`queryKey: [keyQuery]`), asi que
 * solo funcionan si les llega el string raiz: `useGeneralDelete({ keyQuery: "boards" })` produce el
 * prefijo `["boards"]`, que invalida available/details/resources.
 *
 * useGeneralMutation sufre la misma asimetria: al pasarle el array `["boards", "mutate"]` el filtro
 * resultante es `[["boards", "mutate"]]` -- un array anidado que no hace partial match con ninguna
 * query real --, por lo que su invalidacion primaria queda inerte. De ahi que el refresco del
 * listado del sidebar vaya por `additionalQueryKeys`, que si se pasa sin envolver.
 */

const useBoardsMutation = (isUpdate = false) => {
    const navigation = useNavigate();
    const { t } = useTranslation();
    const returnRoute = useBoardFormReturn();
    const { mutate, isPending } = useGeneralMutation({
        /*
         * Mismo prefijo que el listado (`["boards", pageIndex, ...]`) y que el borrado: la
         * invalidacion es por prefijo, asi que una clave propia como ["boards","mutate"] no
         * casaria con ninguna query real y el listado quedaria stale tras crear o editar.
         */
        keyQuery: QUERY_KEYS.BOARDS.ROOT_KEY,
        openModal: true,
        additionalQueryKeys: [QUERY_KEYS.BOARDS.AVAILABLE],
    });

    /*
     * successMessage/errorMessage se emiten desde los callbacks de nivel mutacion de
     * useGeneralDelete, que corren siempre. Los callbacks pasados a mutate no sobreviven al
     * desmontaje del componente, asi que el feedback del borrado se apoya aqui y no en un modal.
     */
    const { mutate: deleteAction } = useGeneralDelete({
        keyQuery: QUERY_KEYS.BOARDS.ROOT_KEY,
        successMessage: t("boards.boardView.deleteBoardSuccessText"),
        errorMessage: t("boards.boardView.deleteBoardErrorText"),
    });

    const mutateBoard = useCallback(
        async (values, setFormikErrors, setFormikStatus) => {
            const valuesForPost = {
                ...values,
                page_size: toOptionalInt(values.page_size, BOARDS_DEFAULT_PAGE_SIZE),
                display_order: toOptionalInt(values.display_order, null),
            };
            const data = genericHandleSendInformation({
                values: valuesForPost,
                urlService: URL_AND_KEYS.boards.url,
                setFormikErrors,
                setFormikStatus,
                pending: isPending,
                options: { keepEmptyStrings: true, ...(isUpdate ? {} : { serverGeneratedId: true }) },
            });
            if (!data.dataPost.orders) {
                data.dataPost.orders = null;
            }
            // formatDataBeforePost descarta los null: sin esto, limpiar el campo no borraria el orden guardado.
            if (data.dataPost.display_order === undefined) {
                data.dataPost.display_order = null;
            }
            const response = await mutate(data);
            if (isUpdate) {
                /*
                 * Al origen, la misma regla que la flecha de volver: `navigate(-1)` dependia
                 * del historial y salia de la aplicacion si la edicion se abrio por enlace.
                 */
                navigation(returnRoute, { replace: true });
            } else {
                /*
                 * El id se lee de la respuesta, no del payload: aqui `serverGeneratedId` deja
                 * la creacion sin id en el cliente y es `POST /boards` quien lo genera y lo
                 * devuelve en `data.id`. (En release/1.23.x es al reves — id de cliente y
                 * `created` sin cuerpo —, asi que ese codigo no se puede copiar tal cual.)
                 */
                const boardId = response?.data?.data?.id ?? response?.data?.id;
                if (boardId) {
                    navigation(`/boards/${boardId}`);
                } else {
                    // Fallback si la respuesta no trae id: al listado, no a "/" (redirige a /auth).
                    navigation("/boards");
                }
            }
        },
        [isPending, mutate, navigation, isUpdate, returnRoute],
    );

    /**
     * @param {string} id
     * @param {{onSuccess?: Function, onError?: Function}} [callbacks] La mutacion no se
     *   espera (react-query no devuelve promesa en `mutate`), asi que el llamador que
     *   necesite reaccionar al resultado tiene que pasarlos aqui.
     */
    const deleteBoard = useCallback(
        (id, callbacks) => {
            deleteAction(
                { id, url: URL_AND_KEYS.boards.url },
                {
                    onSuccess: (deleted) => {
                        if (deleted === false) {
                            callbacks?.onError?.();
                            return;
                        }
                        callbacks?.onSuccess?.();
                    },
                    onError: callbacks?.onError,
                },
            );
        },
        [deleteAction],
    );

    /**
     * Salida del formulario sin guardar: a la vista de la que vino el usuario — los registros
     * del tablero si edito desde ahi, y el listado en cualquier otro caso (ver
     * useBoardFormReturn). Se reemplaza la entrada del historial para que el boton atras del
     * navegador no devuelva al formulario que se acaba de abandonar.
     */
    const goBackFromForm = useCallback(() => navigation(returnRoute, { replace: true }), [navigation, returnRoute]);

    return { isPending, mutateBoard, deleteBoard, goBackFromForm };
};

export default useBoardsMutation;
