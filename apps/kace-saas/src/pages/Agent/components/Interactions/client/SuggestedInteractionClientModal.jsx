import PropTypes from "prop-types";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    Button,
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui-shared";

const isBlank = (value) => value === null || value === undefined || String(value).trim() === "";

const formatValue = (value) => (isBlank(value) ? "—" : String(value).trim());

const getClientName = (client) =>
    [client?.nombres, client?.nombre_empresa, client?.razon_social, client?.name, client?.full_name].find(
        (value) => !isBlank(value),
    );

const getClientDocument = (client) =>
    [client?.tipo_documento, client?.documento]
        .filter((value) => !isBlank(value))
        .map(formatValue)
        .join(" ");

const SuggestedInteractionClientModal = ({
    open,
    onOpenChange,
    senderEmail,
    clients = [],
    onConfirm,
    hasCurrentClient = false,
}) => {
    const { t } = useTranslation();
    const [selectedClientId, setSelectedClientId] = useState("");

    useEffect(() => {
        if (!open) {
            setSelectedClientId("");
            return;
        }

        setSelectedClientId(clients.length === 1 ? String(clients[0].id) : "");
    }, [clients, open]);

    const selectedClient = useMemo(
        () => clients.find((client) => String(client.id) === String(selectedClientId)),
        [clients, selectedClientId],
    );
    const dismissLabel = hasCurrentClient
        ? t("interactions.client.keepCurrentClient", {
              defaultValue: "Keep current Client",
          })
        : t("button.cancel");
    const confirmLabel = hasCurrentClient
        ? t("interactions.client.switchToSuggestedClient", {
              defaultValue: "Switch to suggested Client",
          })
        : t("interactions.client.confirmSuggestedClient", {
              defaultValue: "Use selected Client",
          });

    const handleConfirm = () => {
        if (!selectedClient) return;

        onConfirm?.(selectedClient);
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col overflow-hidden">
                <DialogHeader>
                    <DialogTitle>
                        {t("interactions.client.suggestedClientTitle", {
                            defaultValue: "Suggested Client found",
                        })}
                    </DialogTitle>
                    <DialogDescription>
                        {t("interactions.client.suggestedClientDescription", {
                            defaultValue:
                                "The Interaction sender email matches one or more active Clients. Confirm one to make it the Selected Client.",
                        })}
                    </DialogDescription>
                </DialogHeader>

                <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                    <div className="rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-900">
                        {t("interactions.client.suggestedClientSender", {
                            defaultValue: "Matched sender email: {{email}}",
                            email: senderEmail,
                        })}
                    </div>

                    <div
                        role="list"
                        aria-label={t("interactions.client.suggestedClientResults", {
                            defaultValue: "Suggested Clients",
                        })}
                        className="space-y-2"
                    >
                        {clients.map((client) => {
                            const isSelected = String(client.id) === String(selectedClientId);
                            const matchedFields = Array.isArray(client.suggestedClientMatchedFields)
                                ? client.suggestedClientMatchedFields
                                : [];

                            return (
                                <div key={client.id} role="listitem">
                                    <button
                                        type="button"
                                        className={`w-full rounded-lg border p-4 text-left transition ${
                                            isSelected
                                                ? "border-primary bg-primary/5 shadow-sm"
                                                : "border-input bg-background hover:bg-accent"
                                        }`}
                                        aria-pressed={isSelected}
                                        onClick={() => setSelectedClientId(String(client.id))}
                                    >
                                        <div className="space-y-3">
                                            <div>
                                                <p className="font-medium text-gray-900">
                                                    {formatValue(getClientName(client))}
                                                </p>
                                                <p className="text-sm text-muted-foreground">
                                                    {t("interactions.client.suggestedClientMatchSource", {
                                                        defaultValue: "Matched by Interaction sender email",
                                                    })}
                                                </p>
                                            </div>

                                            <dl className="grid gap-2 text-sm sm:grid-cols-2">
                                                <div>
                                                    <dt className="font-medium text-gray-500">
                                                        {t("interactions.client.document", {
                                                            defaultValue: "Document",
                                                        })}
                                                    </dt>
                                                    <dd className="break-words text-gray-900">
                                                        {formatValue(getClientDocument(client))}
                                                    </dd>
                                                </div>
                                                <div>
                                                    <dt className="font-medium text-gray-500">
                                                        {t("interactions.client.primaryEmail", {
                                                            defaultValue: "Primary email",
                                                        })}
                                                    </dt>
                                                    <dd className="break-words text-gray-900">
                                                        {formatValue(client.email)}
                                                    </dd>
                                                </div>
                                                {matchedFields.some((field) => field.key === "email_alterno") ? (
                                                    <div>
                                                        <dt className="font-medium text-gray-500">
                                                            {t("interactions.client.alternateEmail", {
                                                                defaultValue: "Alternate email",
                                                            })}
                                                        </dt>
                                                        <dd className="break-words text-gray-900">
                                                            {formatValue(client.email_alterno)}
                                                        </dd>
                                                    </div>
                                                ) : null}
                                            </dl>
                                        </div>
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => onOpenChange?.(false)}>
                        {dismissLabel}
                    </Button>
                    <Button type="button" disabled={!selectedClient} onClick={handleConfirm}>
                        {confirmLabel}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

SuggestedInteractionClientModal.propTypes = {
    open: PropTypes.bool.isRequired,
    onOpenChange: PropTypes.func.isRequired,
    senderEmail: PropTypes.string,
    clients: PropTypes.arrayOf(PropTypes.object),
    onConfirm: PropTypes.func.isRequired,
    hasCurrentClient: PropTypes.bool,
};

export default SuggestedInteractionClientModal;
