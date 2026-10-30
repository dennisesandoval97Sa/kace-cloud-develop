import { useState, useEffect, useMemo } from "react";
import PropTypes from "prop-types";
import { useQuery } from "@tanstack/react-query";

import { genericSearchService } from "@/services/genericSearchService";
import { URL_AND_KEYS } from "@/utils/urlAndKeys";

const useRestEndpointCallbackData = (name, values, setFieldValue) => {
    const [selectedResponses, setSelectedResponses] = useState({});
    const [selectedCode, setSelectedCode] = useState("");
    const [selectedFlow, setSelectedFlow] = useState("");

    const selectedFlowIds = useMemo(
        () => [...new Set(Object.values(selectedResponses).filter(Boolean))],
        [selectedResponses],
    );

    const { data: selectedFlowsData } = useQuery({
        queryKey: [URL_AND_KEYS.restFlows.key, "endpoint-callback-labels", selectedFlowIds],
        queryFn: () =>
            genericSearchService(
                `${URL_AND_KEYS.restFlows.url}/search`,
                [{ field: "id", operator: "in", value: selectedFlowIds.join(","), type: "AND" }],
                { limit: selectedFlowIds.length, offset: 0 },
            ),
        enabled: selectedFlowIds.length > 0,
    });

    const flowLabelsById = useMemo(() => {
        const labels = new Map();
        (selectedFlowsData?.data ?? []).forEach((flow) => labels.set(flow.id, flow.description));
        return labels;
    }, [selectedFlowsData]);

    useEffect(() => {
        const newJson = {};

        Object.keys(selectedResponses).forEach((code) => {
            if (selectedResponses[code]) {
                newJson[code] = selectedResponses[code];
            }
        });

        setFieldValue(name, JSON.stringify(newJson, null, 2));
    }, [selectedResponses]);

    const handleResponseSelect = () => {
        if (!selectedCode || !selectedFlow) return;
        setSelectedResponses((prev) => ({
            ...prev,
            [selectedCode]: selectedFlow,
        }));

        setSelectedCode("");
        setSelectedFlow("");
    };

    const handleRemoveFlow = (code) => {
        setSelectedResponses((prev) => {
            const newState = { ...prev };
            delete newState[code];
            return newState;
        });
    };

    const getOptionLabel = (id) => flowLabelsById.get(id) ?? "";

    useEffect(() => {
        if (values?.[name]) {
            setSelectedResponses(JSON.parse(values[name]));
        }
    }, [values]);

    return {
        selectedCode,
        selectedFlow,
        setSelectedCode,
        setSelectedFlow,
        getOptionLabel,
        handleRemoveFlow,
        handleResponseSelect,
        selectedResponses,
    };
};

useRestEndpointCallbackData.propTypes = {
    values: PropTypes.object.isRequired,
    setFieldValue: PropTypes.func.isRequired,
};

export default useRestEndpointCallbackData;
