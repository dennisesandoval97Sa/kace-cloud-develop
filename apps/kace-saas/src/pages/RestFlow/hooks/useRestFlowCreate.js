import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import useGenericSearchQuery from "@kace/hooks/useGenericSearchQuery";
import useGenericViewQuery from "@kace/hooks/useGenericViewQuery";
import useGeneralMutation from "@kace/hooks/useGeneralMutation";
import { WS_REST_STEPS_SERVICE, WS_REST_FLOWS_SERVICE } from "@kace/urls";
import { NAME_LOCATION_FILTER } from "@kace/utils";

import { INITIAL_VALUES_WS_REST_FLOWS } from "../data/constants";
import { genericHandleSendInformation } from "../../../services/genericHandleSendInformation";

const useRestFlowCreate = () => {
    const navigate = useNavigate();
    const [restFlows, setRestFlows] = useState(INITIAL_VALUES_WS_REST_FLOWS);
    const { id } = useParams();
    const shouldFetchFlowDetails = typeof id === "string" && !!id?.trim()?.length;

    const { data, isLoading } = useGenericViewQuery({
        keyQuery: "wsRestFlowsData",
        url: `${WS_REST_FLOWS_SERVICE}/${id}`,
        searchById: id,
        enabled: shouldFetchFlowDetails,
    });

    const { mutate, isPending } = useGeneralMutation({
        keyQuery: "wsRestFlowsData",
    });

    const handleRestFlow = async (path, values, setFormikErrors, setFormikStatus) => {
        const data = genericHandleSendInformation({
            values,
            urlService: WS_REST_FLOWS_SERVICE,
            setFormikErrors,
            setFormikStatus,
            pending: isPending,
        });

        await mutate(data);

        navigate("/rest-flows", { replace: true });
    };

    useEffect(() => {
        if (data && id) {
            setRestFlows(data);
        }
    }, [data]);

    return {
        handleRestFlow,
        restFlows,
        isPending,
        isLoading,
    };
};

export default useRestFlowCreate;
