import { useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AUTOMATION_SETTINGS_SERVICE } from "../../utils/URL";
import { INITIAL_VALUES_AUTOMATION_SETTINGS } from "./data/constants";
import { genericView } from "../../services/genericView";
import { DashboardSectionCard } from "../../components/core/Cards/DashboardSectionCard";
import useGeneralMutation from "../../hooks/useGeneralMutation";
import { genericHandleSendInformation } from "../../services/genericHandleSendInformation";
import AutomationSettingsForm from "./components/AutomationSettingsForm";
import { Button, GeneralLoader } from "@kace/ui-shared";
import useIsSeeMode from "@/hooks/useIsSeeMode";

export const AutomationSettingsCreate = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const isEditMode = Boolean(id);
    const isReadOnly = useIsSeeMode();

    const { data, isError, isLoading, refetch } = useQuery({
        queryKey: ["automationSettingsData", id],
        queryFn: async () => genericView(`${AUTOMATION_SETTINGS_SERVICE}/${id}`),
        enabled: !!id,
    });

    const { mutate, isPending } = useGeneralMutation({
        keyQuery: "automationSettingsData",
        path: "/automation-settings",
    });
    const automationSettings = isEditMode ? data && { ...data, id } : INITIAL_VALUES_AUTOMATION_SETTINGS;

    const handleAutomationSettings = (values, setFormikErrors, setFormikStatus) => {
        if (isReadOnly) return;

        const normalizedValues = {
            ...values,
            ...(isEditMode && { id }),
            start_date: values.start_date.toISOString(),
            end_date: values.end_date.toISOString(),
        };
        const data = genericHandleSendInformation({
            values: normalizedValues,
            urlService: AUTOMATION_SETTINGS_SERVICE,
            setFormikErrors,
            setFormikStatus,
            pending: isPending,
        });
        mutate(data);
    };
    if (isEditMode && isLoading) {
        return (
            <DashboardSectionCard>
                <GeneralLoader />
            </DashboardSectionCard>
        );
    }

    if (isEditMode && (isError || !data)) {
        return (
            <DashboardSectionCard>
                <div className="flex flex-col items-center justify-center gap-4 p-8" role="alert">
                    <p>
                        {t("automationSettings.errors.loadFailure", {
                            defaultValue: "Unable to load this automation.",
                        })}
                    </p>
                    <div className="flex gap-2">
                        <Button type="button" onClick={() => refetch()}>
                            {t("automationSettings.actions.retry", { defaultValue: "Retry" })}
                        </Button>
                        <Button type="button" variant="outline" onClick={() => navigate(-1)}>
                            {t("automationSettings.actions.back", { defaultValue: "Back" })}
                        </Button>
                    </div>
                </div>
            </DashboardSectionCard>
        );
    }

    return (
        <DashboardSectionCard>
            <AutomationSettingsForm
                dataHandler={handleAutomationSettings}
                data={automationSettings}
                isSending={isPending || isLoading}
                mode={isEditMode ? "edit" : "create"}
                isReadOnly={isReadOnly}
            />
        </DashboardSectionCard>
    );
};
