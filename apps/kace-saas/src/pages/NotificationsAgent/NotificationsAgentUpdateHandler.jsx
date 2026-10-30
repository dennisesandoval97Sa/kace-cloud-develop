import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { USER_NOTIFICATIONS_SERVICE } from "../../utils/URL";
import { initialValues } from "./helpers";
import { DashboardSectionCard } from "../../components/core/Cards/DashboardSectionCard";
import { genericView } from "../../services/genericView";
import NotificationsAgentForm from "./components/NotificationsAgentForm";
import { toast } from "sonner";
import { GeneralLoader } from "@kace/ui-shared";
import { useTranslation } from "react-i18next";
import { genericHandleSendInformation } from "../../services/genericHandleSendInformation";
import useGeneralMutation from "../../hooks/useGeneralMutation";
import { normalizeNotificationDateRange } from "../../utils/notificationDates";

const NotificationsAgentUpdateHandler = () => {
    const { t } = useTranslation();
    const [notificationsAgent, setNotificationsAgent] = useState(initialValues);
    const { id } = useParams();
    const { mutate, isPending } = useGeneralMutation({
        keyQuery: "notificationsAgentData",
        additionalQueryKeys: [["notificationsAgentForm", id]],
        path: "/notifications-agent",
    });
    const { data, isLoading } = useQuery({
        queryKey: ["notificationsAgentForm", id],
        queryFn: async () => genericView(`${USER_NOTIFICATIONS_SERVICE}/${id}`),
        enabled: !!id,
    });

    const handleNotificationsAgent = (values, setFormikErrors, setFormikStatus) => {
        if (values.id) {
            values = Object.keys(values).reduce((acc, key) => {
                const currentValue = values[key];
                const previousValue = notificationsAgent[key];

                if ((currentValue !== previousValue && !(!currentValue && !previousValue)) || key === "id") {
                    acc[key] = currentValue;
                }

                return acc;
            }, {});

            if (Object.keys(values).length === 0) {
                toast.info(t("app.alerts.noChanges"));
                return;
            }
        }
        values = normalizeNotificationDateRange(values, { startField: "fecha_inicio", endField: "fecha_fin" });
        const data = genericHandleSendInformation({
            values,
            urlService: USER_NOTIFICATIONS_SERVICE,
            setFormikErrors,
            setFormikStatus,
            pending: isPending,
        });
        mutate(data);
    };

    useEffect(() => {
        if (data) {
            setNotificationsAgent(data);
        }
    }, [data]);

    return (
        <DashboardSectionCard
            title={"app.title.notificationsAgent"}
            data-testid="dashboardCardNotificationsAgentUpdate"
        >
            {isLoading ? (
                <GeneralLoader />
            ) : (
                <NotificationsAgentForm
                    dataHandler={handleNotificationsAgent}
                    data={notificationsAgent}
                    isSending={isPending || isLoading}
                />
            )}
        </DashboardSectionCard>
    );
};

export default NotificationsAgentUpdateHandler;
