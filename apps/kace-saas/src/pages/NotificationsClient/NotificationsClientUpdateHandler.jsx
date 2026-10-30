import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CLIENT_NOTIFICATIONS_SERVICE } from "../../utils/URL";
import { initialValues } from "./helpers";
import { DashboardSectionCard } from "../../components/core/Cards/DashboardSectionCard";
import { genericView } from "../../services/genericView";
import NotificationsClientForm from "./components/NotificationsClientForm";
import { toast } from "sonner";
import { GeneralLoader } from "@kace/ui-shared";
import { useTranslation } from "react-i18next";
import { genericHandleSendInformation } from "../../services/genericHandleSendInformation";
import useGeneralMutation from "../../hooks/useGeneralMutation";
import { normalizeNotificationDateRange } from "../../utils/notificationDates";

const NotificationsClientUpdateHandler = () => {
    const { t } = useTranslation();
    const [notificationsClient, setNotificationsClient] = useState(initialValues);
    const { id } = useParams();
    const { mutate, isPending } = useGeneralMutation({
        keyQuery: "notificationsClientData",
        additionalQueryKeys: [["notificationsClientForm", id]],
        path: "/notifications-client",
    });
    const { data, isLoading } = useQuery({
        queryKey: ["notificationsClientForm", id],
        queryFn: async () => genericView(`${CLIENT_NOTIFICATIONS_SERVICE}/${id}`),
        enabled: !!id,
    });

    const handleNotificationsClient = (values, setFormikErrors, setFormikStatus) => {
        if (values.id) {
            values = Object.keys(values).reduce((acc, key) => {
                const currentValue = values[key];
                const previousValue = notificationsClient[key];

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
        values = normalizeNotificationDateRange(values, { startField: "start_date", endField: "end_date" });
        const data = genericHandleSendInformation({
            values,
            urlService: CLIENT_NOTIFICATIONS_SERVICE,
            setFormikErrors,
            setFormikStatus,
            pending: isPending,
        });
        mutate(data);
    };

    useEffect(() => {
        if (data) {
            setNotificationsClient(data);
        }
    }, [data]);

    return (
        <DashboardSectionCard
            title={"app.title.notificationsClient"}
            data-testid="dashboardCardNotificationsClientUpdate"
        >
            {isLoading ? (
                <GeneralLoader />
            ) : (
                <NotificationsClientForm
                    dataHandler={handleNotificationsClient}
                    data={notificationsClient}
                    isSending={isPending || isLoading}
                />
            )}
        </DashboardSectionCard>
    );
};

export default NotificationsClientUpdateHandler;
