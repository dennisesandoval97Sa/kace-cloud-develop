import { useMemo } from "react";
import { useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { GeneralLoader } from "@kace/ui-shared";
import { DashboardSectionCard } from "@/components/core/Cards/DashboardSectionCard";
import useGeneralMutation from "@kace/hooks/useGeneralMutation";
import useGenericViewQuery from "@kace/hooks/useGenericViewQuery";
import { genericHandleSendInformation } from "@/services/genericHandleSendInformation";
import { FOLIO_CONFIGURATIONS_SERVICE } from "@/utils/main";
import { FolioConfigurationForm } from "./components/FolioConfigurationForm";

/**
 * Only scalars get the ?? "" treatment: segments must stay an array or the builder would
 * receive "" and render nothing.
 */
export const normalizeConfiguration = (configuration) =>
    Object.fromEntries(
        Object.entries(configuration).map(([key, value]) =>
            key === "segments" ? [key, value ?? []] : [key, value ?? ""],
        ),
    );

export const FolioConfigurationUpdate = () => {
    const { id } = useParams();
    const { t } = useTranslation();

    const {
        data: dataFromServer,
        isLoading,
        isError,
    } = useGenericViewQuery({
        keyQuery: "folioConfigurationForm",
        url: `${FOLIO_CONFIGURATIONS_SERVICE}/${id}`,
        searchById: [id],
        enabled: !!id,
    });

    const { mutate, isPending } = useGeneralMutation({
        keyQuery: "folioConfigurations",
        path: "/folio-configurations",
    });

    const configurationData = useMemo(
        () => (dataFromServer ? normalizeConfiguration(dataFromServer) : null),
        [dataFromServer],
    );

    const handleSubmit = (values, setFormikErrors, setFormikStatus) => {
        const data = genericHandleSendInformation({
            values,
            urlService: FOLIO_CONFIGURATIONS_SERVICE,
            setFormikErrors,
            setFormikStatus,
            pending: isPending,
            // Without it an emptied description is dropped from the payload and the old one stays.
            options: { fieldsToKeepEmpty: ["descripcion"] },
        });
        mutate(data);
    };

    /*
     * Until the configuration arrives the form has no id, so saving would POST a new
     * configuration instead of updating this one. Neither the loading nor the failed state
     * may fall back to the creation form.
     */
    const renderContent = () => {
        if (id && isLoading) return <GeneralLoader />;

        if (id && (isError || !configurationData)) {
            return (
                <p className="text-sm text-destructive" role="alert" data-testid="folio_configuration_load_error">
                    {t("folioConfigurations.messages.loadError")}
                </p>
            );
        }

        return <FolioConfigurationForm data={configurationData} dataHandler={handleSubmit} isSending={isPending} />;
    };

    return <DashboardSectionCard title={t("navbar.folioConfigurations")}>{renderContent()}</DashboardSectionCard>;
};
