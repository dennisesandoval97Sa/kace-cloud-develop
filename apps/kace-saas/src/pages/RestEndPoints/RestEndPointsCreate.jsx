import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router-dom";
import { WS_REST_ENDPOINTS_SERVICE } from "../../utils/URL";
import { INITIAL_VALUES_WS_REST_ENDPOINTS } from "./data/constants";
import { genericView } from "../../services/genericView";
import RestEndPointsForm from "./components/RestEndPointsForm";
import { DashboardSectionCard } from "../../components/core/Cards/DashboardSectionCard";
import useGeneralMutation from "../../hooks/useGeneralMutation";
import { genericHandleSendInformation } from "../../services/genericHandleSendInformation";

export const RestEndPointsCreate = () => {
    const [restEndpoints, setRestEndPoints] = useState(INITIAL_VALUES_WS_REST_ENDPOINTS);
    const { id } = useParams();

    const { data, isLoading } = useQuery({
        queryKey: ["wsRestEndpointsData", id],
        queryFn: async () => genericView(`${WS_REST_ENDPOINTS_SERVICE}/${id}`),
        enabled: !!id,
    });

    const { mutate, isPending } = useGeneralMutation({
        keyQuery: "wsRestEndpointsData",
        path: "/rest-endpoints",
    });

    const handleRestEndpoints = (values, setFormikErrors, setFormikStatus) => {
        const data = genericHandleSendInformation({
            values,
            urlService: WS_REST_ENDPOINTS_SERVICE,
            setFormikErrors,
            setFormikStatus,
            pending: isPending,
            options: {
                fieldsToKeepNull: [
                    "authorization_id",
                    "cache_expires_in_path",
                    "cache_default_ttl_seconds",
                    "body_type",
                ],
            },
        });
        mutate(data);
    };
    useEffect(() => {
        if (data) {
            setRestEndPoints(data);
        }
    }, [data]);

    return (
        <DashboardSectionCard>
            <RestEndPointsForm
                dataHandler={handleRestEndpoints}
                data={restEndpoints}
                isSending={isPending || isLoading}
            />
        </DashboardSectionCard>
    );
};
