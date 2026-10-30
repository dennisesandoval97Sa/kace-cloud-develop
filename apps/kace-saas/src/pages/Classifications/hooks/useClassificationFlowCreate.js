import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import useGenericViewQuery from "@kace/hooks/useGenericViewQuery";
import useGeneralMutation from "@kace/hooks/useGeneralMutation";

import { genericHandleSendInformation } from "@/services/genericHandleSendInformation";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";
import { INITIAL_VALUES_CLASSIFICATION_FLOWS } from "../data/constants";

const useClassificationFlowCreate = () => {
    const navigate = useNavigate();
    const [flow, setFlow] = useState(INITIAL_VALUES_CLASSIFICATION_FLOWS);
    const { id } = useParams();
    const shouldFetchFlowDetails = typeof id === "string" && !!id?.trim()?.length;

    const { data, isLoading, refetch } = useGenericViewQuery({
        keyQuery: [URL_AND_KEYS.classification.url, id],
        url: `${URL_AND_KEYS.classification.url}/${id}`,
        searchById: id,
        enabled: shouldFetchFlowDetails,
    });

    useEffect(() => {
        if (!data) return;

        const existingEdges = Array.isArray(data?.json_flujo?.edges) ? data.json_flujo.edges : [];
        let startTarget = existingEdges[0]?.source;
        if (!startTarget && Array.isArray(data?.json_flujo?.nodes)) {
            const primaryNode = data.json_flujo.nodes.find(n => n?.data?.type === 'primary');
            startTarget = primaryNode?.id;
        }

        const startEdge = startTarget ? {
            id: "reactflow__edge-0",
            source: "0",
            target: startTarget,
            sourceHandle: null,
            targetHandle: null,
            type: "custom",
        } : null;

        const enriched = {
            ...data,
            json_flujo: {
                ...data?.json_flujo,
                edges: startEdge ? [startEdge, ...existingEdges] : existingEdges,
            },
        };

        const signature = `${enriched?.id || ''}:${enriched?.json_flujo?.nodes?.length || 0}:${enriched?.json_flujo?.edges?.length || 0}`;
        setFlow((prev) => {
            const prevSignature = `${prev?.id || ''}:${prev?.json_flujo?.nodes?.length || 0}:${prev?.json_flujo?.edges?.length || 0}`;
            if (prevSignature === signature) {
                return prev;
            }
            return enriched;
        });
    }, [data]);

    useEffect(() => {
        if (id && shouldFetchFlowDetails) {
            refetch();
        }
    }, [id]);

    const { mutate, isPending, isSuccess } = useGeneralMutation({
        keyQuery: "classificationFlowData",
        url: URL_AND_KEYS.classification.url,
    });
    
    const handleClassificationFlow = (path, values, setFormikErrors, setFormikStatus) => {
        values.json_flujo.edges = values.json_flujo.edges.filter((edge) => edge.source !== "0");

        const { description, relations, ...payload } = values;

        const finalData = genericHandleSendInformation({
            values: payload,
            urlService: URL_AND_KEYS.classification.url,
            setFormikErrors,
            setFormikStatus,
            pending: isPending,
        });

        mutate(finalData);
    };

    useEffect(() => {
        if (isSuccess) {
            navigate("/clasificaciones", { replace: true });
        }
    }, [isSuccess, navigate]);

    return {
        handleClassificationFlow,
        isPending,
        isLoading,
        flow,
    };
};

export default useClassificationFlowCreate;
