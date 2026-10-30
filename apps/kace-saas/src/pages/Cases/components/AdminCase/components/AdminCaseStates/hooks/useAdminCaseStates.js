import useGenericSearchQuery from "@kace/hooks/useGenericSearchQuery";
import useGenericViewQuery from "@kace/hooks/useGenericViewQuery";
import { useQueryClient } from "@tanstack/react-query";
import { useFormikContext } from "formik";
import { useCallback, useEffect, useMemo, useState } from "react";
import { genericView } from "../../../../../../../services/genericView";
import { URL_AND_KEYS } from "../../../../../../../utils/urlAndKeys";

const useAdminCaseStates = (flowId, currentTransitionId) => {
    const queryClient = useQueryClient();
    const { setFieldValue } = useFormikContext();

    const [states, setStates] = useState([]);
    const [defaultState, setDefaultState] = useState(null);
    const [loadingStates, setLoadingStates] = useState(false);

    const { data: currentTransitionData, isFetching: isLoadingCurrentTransitionData } = useGenericViewQuery({
        url: `${URL_AND_KEYS.transitions.url}/${currentTransitionId}`,
        searchById: [currentTransitionId],
        enabled: !flowId && currentTransitionId,
        keyQuery: URL_AND_KEYS.transitions.key,
        gcTime: 0,
        staleTime: 0,
    });

    const getStateName = useCallback(async (stateId, isStateData = false) => {
        const queryKey = isStateData ? URL_AND_KEYS.states.stateData : URL_AND_KEYS.states.stateCurrentData;
        const stateData = await queryClient.fetchQuery({
            queryKey: [queryKey, stateId],
            queryFn: () => genericView(`${URL_AND_KEYS.states.url}/${stateId}`),
        });

        return stateData?.nombre || "Sin datos";
    }, []);

    const currentFlowId = useMemo(
        () => flowId || currentTransitionData?.flujo_id || "",
        [flowId, currentTransitionData?.flujo_id],
    );

    const { data: transitionsData, isFetching: transitionsLoading } = useGenericSearchQuery({
        url: `${URL_AND_KEYS.transitions.url}/search`,
        keyQuery: `${URL_AND_KEYS.transitions.searchCaseTransitions}, ${currentFlowId}`,
        searchById: URL_AND_KEYS.cases.keyAdminCase,
        select: (data) => data.data,
        filter: [
            {
                field: "transiciones.flujo_id",
                operator: "eq",
                value: currentFlowId,
                type: "AND",
            },
        ],
        table: "transiciones",
        pagination: {
            limit: 0,
            offset: 0,
        },
        useDefault: false,
        enabled: !!currentFlowId,
        staleTime: 0,
        gcTime: 0,
        refetchOnWindowFocus: false,
    });

    const transitionsHandler = async () => {
        setLoadingStates(true);
        try {
            if (!transitionsData?.length || !currentFlowId) {
                setStates([]);
                setDefaultState(null);
                return;
            }

            const currentTransitionData = transitionsData.find(({ id }) => id === currentTransitionId);

            if (currentTransitionData) {
                const nombre = await getStateName(currentTransitionData?.siguiente_estado_id);
                setDefaultState({
                    transition_id: currentTransitionData?.id,
                    state_id: currentTransitionData?.siguiente_estado_id,
                    nombre,
                });
                setFieldValue("transicion_id", currentTransitionData?.id || "", false);
            }
            const currentStateId = currentTransitionData?.siguiente_estado_id || null;
            const availableStates = transitionsData
                .filter(
                    ({ estado_actual_id, status, is_visible }) =>
                        estado_actual_id === currentStateId && status === 1 && is_visible === true,
                )
                .map(async ({ id, siguiente_estado_id }) => {
                    const nombre = await getStateName(siguiente_estado_id, true);
                    return {
                        transition_id: id,
                        state_id: siguiente_estado_id,
                        nombre,
                    };
                });
            const nextStates = await Promise.all(availableStates);
            setStates(nextStates);
        } catch {
            // NO-SONAR: En caso de error general, se limpia el estado de "States" para evitar mostrar datos incompletos o incorrectos.
            setStates([]);
        } finally {
            setLoadingStates(false);
        }
    };

    useEffect(() => {
        transitionsHandler();
    }, [transitionsData, currentFlowId]);

    return {
        defaultState,
        states,
        isLoading: isLoadingCurrentTransitionData || loadingStates || transitionsLoading,
    };
};

export default useAdminCaseStates;
