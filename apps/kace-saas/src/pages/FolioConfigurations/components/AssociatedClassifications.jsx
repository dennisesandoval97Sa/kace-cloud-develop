import PropTypes from "prop-types";
import { useTranslation } from "react-i18next";
import useGenericGetQuery from "@kace/hooks/useGenericGetQuery";
import { FOLIO_CONFIGURATIONS_SERVICE } from "@/utils/main";

const selectClassifications = (response) => response?.data?.data?.classifications ?? [];

/**
 * Read-only list of the classifications that use this configuration.
 *
 * The association is edited in one place only: the `folio_config_id` select on the
 * classification form. The endpoint returns each classification already described, so this
 * screen never has to load the whole catalogue just to resolve the labels.
 */
const AssociatedClassifications = ({ configurationId }) => {
    const { t } = useTranslation();

    // useGenericGetQuery keys the cache by `keyQuery` alone, so the id has to be part of it.
    const {
        data: classifications = [],
        isLoading,
        isError,
    } = useGenericGetQuery({
        keyQuery: `folioConfigurationClassifications-${configurationId}`,
        url: `${FOLIO_CONFIGURATIONS_SERVICE}/${configurationId}/classifications`,
        select: selectClassifications,
    });

    /*
     * Loading and failure must not read as "no classification uses it": an administrator
     * could then link the configuration somewhere it is already in use.
     */
    const renderList = () => {
        if (isLoading) {
            return (
                <p className="text-sm text-muted-foreground" data-testid="folio_classifications_loading">
                    {t("folioConfigurations.classifications.loading")}
                </p>
            );
        }

        if (isError) {
            return (
                <p className="text-sm text-destructive" role="alert" data-testid="folio_classifications_error">
                    {t("folioConfigurations.classifications.loadError")}
                </p>
            );
        }

        if (classifications.length === 0) {
            return (
                <p className="text-sm text-muted-foreground" data-testid="folio_classifications_empty">
                    {t("folioConfigurations.classifications.empty")}
                </p>
            );
        }

        return (
            <ul className="max-h-64 overflow-auto rounded-md border border-border p-2">
                {classifications.map((classification) => (
                    <li
                        key={classification.id}
                        className="py-1 text-sm"
                        data-testid={`folio_classification_${classification.id}`}
                    >
                        {classification.description}
                    </li>
                ))}
            </ul>
        );
    };

    return (
        <div className="flex flex-col gap-3" data-testid="folio_classifications">
            <p className="text-xs text-muted-foreground">{t("folioConfigurations.classifications.hint")}</p>
            {renderList()}
        </div>
    );
};

AssociatedClassifications.propTypes = {
    configurationId: PropTypes.string.isRequired,
};

export default AssociatedClassifications;
