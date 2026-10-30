import PropTypes from "prop-types";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, UserPen } from "lucide-react";
import { Button } from "@/components/ui-shared";
import { openCaseAction } from "../utils/openCaseAction";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";
import { useAgentContext } from "../../../context/AgentContext";

const isBlank = (value) => value === null || value === undefined || String(value).trim() === "";

const formatValue = (value) => String(value).trim();

const getClientName = (client) =>
    [client?.nombres, client?.nombre_empresa, client?.razon_social, client?.name, client?.full_name].find(
        (value) => !isBlank(value),
    );

const getClientDocument = (client) =>
    [client?.tipo_documento, client?.documento]
        .filter((value) => !isBlank(value))
        .map(formatValue)
        .join(" ");

const InteractionsClientBox = ({ interactionEmail, interaction, isSearchingSuggestedClient = false }) => {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { t } = useTranslation();
    const email = interactionEmail;
    const { clientId: selectedClientId, dataUserSelected, isNewClient } = useAgentContext();

    const selectedClient = useMemo(() => {
        if (isNewClient || !selectedClientId) return null;

        return {
            ...(dataUserSelected || {}),
            id: dataUserSelected?.id ?? selectedClientId,
        };
    }, [dataUserSelected, isNewClient, selectedClientId]);
    const panelClient = selectedClient;
    const clientSummaryRows = [
        {
            label: t("interactions.client.name", { defaultValue: "Name" }),
            value: getClientName(panelClient),
        },
        {
            label: t("interactions.client.document", { defaultValue: "Document" }),
            value: getClientDocument(panelClient),
        },
    ].filter((row) => !isBlank(row.value));

    return (
        <div className="flex h-[calc(100vh-330px)] flex-col gap-4 overflow-auto rounded-lg bg-white p-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-gray-800">
                    <UserPen className="h-6 w-6 text-blue-800" />
                    <p className="text-lg font-medium">{t("interactions.client.customerData")}</p>
                </div>
            </div>

            <section className="rounded-xl border border-gray-200 bg-white p-3">
                <h3 className="text-sm font-bold text-gray-900">
                    {t("interactions.client.selectedClient", { defaultValue: "Selected Client" })}
                </h3>

                {panelClient ? (
                    <dl className="mt-3 space-y-2">
                        {clientSummaryRows.map((row) => (
                            <div key={row.label} className="min-w-0">
                                <dt className="text-xs font-medium text-gray-500">{row.label}</dt>
                                <dd className="truncate text-sm text-gray-900">{formatValue(row.value)}</dd>
                            </div>
                        ))}
                    </dl>
                ) : (
                    <div className="mt-3 space-y-1 text-sm">
                        <p className="font-medium text-gray-700">
                            {t("interactions.client.noSelectedClient", { defaultValue: "No selected Client" })}
                        </p>
                        {email && <p className="break-words text-xs text-gray-500">{email}</p>}
                    </div>
                )}
            </section>

            {!panelClient && isSearchingSuggestedClient && (
                <section
                    role="status"
                    aria-live="polite"
                    className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900 shadow-sm"
                >
                    <div className="flex items-start gap-3">
                        <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin" aria-hidden="true" />
                        <div className="space-y-1">
                            <p className="font-medium">
                                {t("interactions.client.searchingSuggestedClient", {
                                    defaultValue: "Searching for a matching Client",
                                })}
                            </p>
                            <p className="text-xs text-blue-800">
                                {t("interactions.client.searchingSuggestedClientDescription", {
                                    defaultValue:
                                        "Checking the Interaction sender email before you select or create a Client.",
                                })}
                            </p>
                        </div>
                    </div>
                </section>
            )}

            {interaction?.caseId && (
                <div className="flex justify-end">
                    <Button
                        size="sm"
                        variant="outline"
                        type="button"
                        onClick={() =>
                            openCaseAction({
                                dispatch,
                                navigate,
                                id: interaction.caseId,
                                reference: interaction?.caseReference,
                            })
                        }
                    >
                        {t("interactions.cases.viewCase")}
                    </Button>
                </div>
            )}
        </div>
    );
};

InteractionsClientBox.propTypes = {
    interactionEmail: PropTypes.string,
    interaction: PropTypes.object,
    isSearchingSuggestedClient: PropTypes.bool,
};

export default InteractionsClientBox;
