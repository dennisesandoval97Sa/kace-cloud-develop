import { useCallback, useState } from "react";
import useGeneralMutation from "@kace/hooks/useGeneralMutation";
import { QUERY_KEYS } from "@kace_v2/shared/constants/query-keys.constants";
import { genericHandleSendInformation } from "@/services/genericHandleSendInformation";
import { API } from "@kace_v2/shared/constants/api.constants";
import { useNavigate } from "react-router-dom";

const useBoardsTriggerOptions = () => {
    const [showOSModal, setShowOSModal] = useState(false);
    const [oneScriptId, setOneScriptId] = useState(null);
    const [selectedEntity, setSelectedEntity] = useState(null);
    const navigation = useNavigate();

    /*
     * Igual que en useBoardsMutation.hook.js (ver el comentario de ese archivo), pasar el array
     * BOARDS.MUTATE deja la invalidacion primaria inerte: useGeneralMutation la envuelve y produce
     * `[["boards", "mutate"]]`, que no hace partial match con ninguna query real. Aqui se deja asi a
     * proposito: estas acciones operan sobre registros del tablero, no sobre su configuracion, y el
     * refresco del listado ya lo cubre el refetchInterval de `resources` en useBoard.hook.js.
     */
    const { mutate, isPending } = useGeneralMutation({
        keyQuery: QUERY_KEYS.BOARDS.MUTATE,
        openModal: true,
    });

    const executeAction = useCallback(
        async (action_id, value) => {
            const values = {
                type: "filter",
                evaluate_conditions: false,
                action_id,
                search_filter: {
                    filter: [
                        {
                            field: "cases.id",
                            operator: "eq",
                            type: "AND",
                            value,
                        },
                    ],
                    limit: 0,
                    offset: 0,
                },
            };
            const data = genericHandleSendInformation({
                values,
                urlService: API.ENDPOINTS.ACTION_JOBS.ROOT,
                pending: isPending,
            });
            await mutate(data);
        },
        [isPending, mutate, genericHandleSendInformation],
    );

    const executeRestflow = useCallback(
        async (restflow_id, value) => {
            const values = {
                type: "filter",
                evaluate_conditions: false,
                restflow_id,
                search_filter: {
                    filter: [
                        {
                            field: "cases.id",
                            operator: "eq",
                            type: "AND",
                            value,
                        },
                    ],
                    limit: 0,
                    offset: 0,
                },
            };
            const data = genericHandleSendInformation({
                values,
                urlService: API.ENDPOINTS.ACTION_JOBS.ROOT,
                pending: isPending,
            });
            await mutate(data);
        },
        [isPending, mutate, genericHandleSendInformation],
    );

    const executeOneScript = useCallback(
        (one_script_id) => {
            setOneScriptId(one_script_id);
            setShowOSModal(true);
        },
        [setShowOSModal],
    );

    const viewCase = useCallback((case_id, board_id = null) => {
        if (case_id) {
            const currentPath = window.location.pathname;
            const isAgentView = currentPath.includes("/agent");
            const route = isAgentView
                ? `/agent/update/${case_id}?action=edit&role=agente${board_id ? `&board_id=${board_id}` : ""}`
                : `/cases/update/${case_id}?role=administrador${board_id ? `&board_id=${board_id}` : ""}`;
            /*
             * Solo en el modulo de agente se recuerda la vista exacta de origen (incluye el
             * cliente seleccionado en la ruta) para poder regresar al tablero cuando el caso
             * se guarda desde OneScript; el modulo administrativo no consume ese retorno.
             */
            const options = isAgentView
                ? { state: { boardReturnTo: `${currentPath}${window.location.search}` } }
                : undefined;
            navigation(route, options);
        }
    }, []);

    const triggerOption = useCallback(async (type, ref_id, resource_id, board_id = null) => {
        setSelectedEntity(resource_id);
        switch (type) {
            case "ACTION":
                await executeAction(ref_id, resource_id);
                break;

            case "RESTFLOW":
                await executeRestflow(ref_id, resource_id);
                break;

            case "VIEWCASE":
                viewCase(resource_id, board_id);
                break;

            default:
                executeOneScript(ref_id);
                break;
        }
    }, []);

    return { showOSModal, oneScriptId, selectedEntity, setSelectedEntity, setShowOSModal, triggerOption };
};

export default useBoardsTriggerOptions;
