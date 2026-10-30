import { FLOW_SERVICE, STATE_SERVICE } from "../../../utils/URL";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import { INITIAL_VALUES_FLOWS } from "../data/constants";
import { genericSearch } from "../../../services/genericSearch";
import { genericHandleSendInformation } from "../../../services/genericHandleSendInformation";
import useGeneralMutation from "../../../hooks/useGeneralMutation";
import { useTranslation } from "react-i18next";
import { apiService } from "@kace/utils";
import useGenericSearchQuery from "@/hooks/useGenericSearchQuery";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";

const getApiErrorMessages = (error) => {
    const responseData = error?.response?.data;
    const legacyErrors = responseData?.errors;

    if (typeof legacyErrors === "string") {
        return [legacyErrors];
    }

    if (Array.isArray(legacyErrors)) {
        return legacyErrors
            .map((legacyError) => legacyError?.message ?? legacyError)
            .filter((message) => typeof message === "string");
    }

    return [responseData?.message, responseData?.error, error?.message].filter(
        (message) => typeof message === "string",
    );
};

async function fetchDelete(id) {
    try {
        const response = await apiService.get(`${FLOW_SERVICE}/${id}/delete`);
        return response.status === 200 || response.data.message === "Success";
    } catch (error) {
        if (
            getApiErrorMessages(error).some((message) => message.includes("The flow you are trying update is in use"))
        ) {
            return "in use";
        }
        return false;
    }
}

const useFlowActions = () => {
    const [flow, setFlow] = useState(INITIAL_VALUES_FLOWS);
    const [nodes, setNodes] = useState([]);
    const [availableNodes, setAvailableNodes] = useState([]);
    const [edges, setEdges] = useState([]);
    const [handleLoading, setHandleLoading] = useState(false);
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { id } = useParams();
    const {
        mutate: updateFlowMutation,
        isPending: isUpdatePending,
        queryClient,
    } = useGeneralMutation({
        keyQuery: "flowsData",
        path: "/flujos",
    });

    const { data: ansList, isLoading: ansListLoading } = useGenericSearchQuery({
        url: `${URL_AND_KEYS.ans.url}/search`,
        keyQuery: URL_AND_KEYS.ans.key,
        select: (data) => data?.data?.map((item) => ({ value: item.id, label: item.nombre })) || [],
    });

    const { data: rulesListRaw, isLoading: rulesListLoading } = useGenericSearchQuery({
        url: `${URL_AND_KEYS.transitionRules.url}/search`,
        keyQuery: URL_AND_KEYS.transitionRules.key,
        select: (data) => data?.data?.map((item) => ({ value: item.id, label: item.nombre })) || [],
    });

    const rulesList = rulesListRaw?.length ? rulesListRaw : null;

    const cachedData = queryClient.getQueryData(["flowsData"]);
    const { data: dataFlowSelected, isLoading } = useQuery({
        queryKey: ["flowsForm", id],
        queryFn: () => {
            if (cachedData && id) {
                const cachedState = cachedData.data.find((state) => state.id === id);
                if (cachedState) {
                    return Promise.resolve({ data: { data: cachedState } });
                }
            }
            return apiService.get(`${FLOW_SERVICE}/${id}`);
        },
        enabled: !!id,
    });

    const { data: statesData, isLoading: isAvailableStatesLoading } = useQuery({
        queryKey: ["availableStatesFlow"],
        queryFn: async () =>
            genericSearch(`${STATE_SERVICE}/search`, [], {
                limit: 1000,
                offset: 0,
            }),
    });

    const { mutate } = useMutation({
        mutationFn: fetchDelete,
        onMutate: async (id) => {
            await queryClient.cancelQueries(["flowsData"]);
            const previousGroups = queryClient.getQueryData(["flowsData"]);
            queryClient.setQueryData(["flowsData"], (old) => {
                if (old && old.data) {
                    return {
                        ...old,
                        data: old.data.filter((item) => item.id !== id),
                    };
                }
                return old;
            });
            return { previousGroups };
        },
        onError: (_err, id, context) => {
            queryClient.setQueryData(["flowsData"], context.previousGroups);
            toast.error(`${t("app.forms.error_delete")} ${t("app.title.flows")}`);
        },
        onSuccess: (data, _variables, context) => {
            if (data === "in use") {
                queryClient.invalidateQueries(["flowsData"]);
                toast.info(`${t("app.title.flows")} se encuentra en uso`);
                queryClient.setQueryData(["flowsData"], context.previousGroups);
                return;
            }

            queryClient.invalidateQueries(["flowsData"]);
            toast.success(t("app.forms.success_delete_module", { module: t("app.title.flows") }));
        },
    });

    const handleFlow = async (values, setFormikErrors, setFormikStatus) => {
        try {
            setHandleLoading(true);
            const isCreate = !id;

            const parsedValues = {
                ...values,
                json_flujo: typeof values.json_flujo === "string" ? JSON.parse(values.json_flujo) : values.json_flujo,
            };

            const data = genericHandleSendInformation({
                values: parsedValues,
                urlService: FLOW_SERVICE,
                setFormikErrors,
                setFormikStatus,
                pending: isUpdatePending,
                options: { serverGeneratedId: true, isCreate },
            });

            updateFlowMutation(data, {
                onError: () => {
                    toast.warning(`${t("app.forms.error")}`);
                },
            });
        } catch {
            // NO-SONAR: Se captura cualquier error para evitar que afecte la funcionalidad del flujo.
            setHandleLoading(false);
        } finally {
            setHandleLoading(false);
        }
    };

    useEffect(() => {
        if (statesData) {
            setAvailableNodes(statesData.data);
        }
    }, [statesData]);
    useEffect(() => {
        if (dataFlowSelected) {
            setFlow(dataFlowSelected.data.data);
            if (dataFlowSelected.data.data.json_flujo.edges) setEdges(dataFlowSelected.data.data.json_flujo.edges);
            if (dataFlowSelected.data.data.json_flujo.nodes) setNodes(dataFlowSelected.data.data.json_flujo.nodes);
        }
    }, [dataFlowSelected]);

    return {
        handleUpdateFlow: (id) => {
            navigate(`/flujos/update/${id}`);
        },
        handleDeleteFlow: (id) => {
            mutate(id);
        },
        handleSeeFlow: (id) => {
            navigate(`/flujos/update/${id}?action=see`);
        },
        flow,
        nodes,
        edges,
        ansList,
        rulesList,
        setNodes,
        setEdges,
        availableNodes,
        isAvailableStatesLoading,
        isLoading: isLoading || ansListLoading || rulesListLoading,
        handleFlow,
        isUpdatePending: isUpdatePending || handleLoading,
    };
};

export default useFlowActions;
