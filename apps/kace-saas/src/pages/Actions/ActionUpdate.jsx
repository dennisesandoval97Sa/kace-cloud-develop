import { useEffect, useState } from "react";
import { DashboardSectionCard } from "../../components/core/Cards/DashboardSectionCard";
import { ActionForm } from "./components/ActionForm";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { genericView } from "../../services/genericView";
import useGeneralMutation from "../../hooks/useGeneralMutation";
import { genericHandleSendInformation } from "../../services/genericHandleSendInformation";
import { ACTIONS_SERVICE } from "@kace/utils";

export const ActionUpdate = () => {
    const [actions, setActions] = useState(null);
    const { id } = useParams();

    const { data: dataGeneralSetup } = useQuery({
        queryKey: ["generalSetupForm", id],
        queryFn: async () => genericView(`${ACTIONS_SERVICE}/${id}`),
        enabled: !!id,
    });

    const { mutate, isPending } = useGeneralMutation({
        keyQuery: "actions",
        path: "/actions",
    });

    const handleGeneralSetupUpdate = (values, setFormikErrors, setFormikStatus) => {
        const data = genericHandleSendInformation({
            values,
            urlService: ACTIONS_SERVICE,
            setFormikErrors,
            setFormikStatus,
            pending: isPending,
        });
        mutate(data);
    };

    useEffect(() => {
        if (dataGeneralSetup) {
            const cleanedData = Object.fromEntries(
                Object.entries(dataGeneralSetup).map(([key, value]) => [key, value ?? ""]),
            );

            setActions(cleanedData);
        }
    }, [dataGeneralSetup]);
    return (
        <DashboardSectionCard title="navbar.actions">
            <ActionForm
                data={actions}
                dataHandler={handleGeneralSetupUpdate}
                isSending={isPending}
                id="action_form_update"
                data-testid="action_form_update"
            />
        </DashboardSectionCard>
    );
};
